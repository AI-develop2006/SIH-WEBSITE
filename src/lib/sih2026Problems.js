/**
 * SIH 2026 Problem Statements & Team Details — Live Database Layer
 *
 * All problem statements and team problem selection details are fetched dynamically
 * from the live database via API calls (/api/problems/sih2026).
 */

import { useState, useEffect, useRef } from "react";
import { fetchSihProblems } from "./data.js";

// Exported for backwards compatibility — dynamically populated via live API call
export const SIH2026_PROBLEMS = [];

let _liveProblems = null;
let _fetchPromise = null;

async function _ensureLive() {
  if (_liveProblems) return _liveProblems;
  if (!_fetchPromise) {
    _fetchPromise = fetchSihProblems().then(({ data }) => {
      if (data && data.length > 0) {
        _liveProblems = data.map((p) => ({
          ...p,
          psNumber: p.psNumber ?? p.ps_number,
        }));
      } else {
        _liveProblems = [];
      }
      return _liveProblems;
    }).catch(() => {
      _liveProblems = [];
      return _liveProblems;
    });
  }
  return _fetchPromise;
}

export async function refreshSihProblems() {
  _liveProblems = null;
  _fetchPromise = null;
  return _ensureLive();
}


/**
 * React hook — returns live problem statements and team assignment data directly from the DB.
 */
export function useSihProblems() {
  const [problems, setProblems] = useState(_liveProblems ?? []);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (_liveProblems) {
      setProblems(_liveProblems);
      return;
    }
    _ensureLive().then((data) => {
      if (mounted.current) setProblems(data);
    });
    return () => { mounted.current = false; };
  }, []);

  return problems;
}

/**
 * React hook — returns Map<psNumber, problem> built live from the database.
 */
export function useSihPsMap() {
  const problems = useSihProblems();
  return new Map(problems.map((p) => [p.psNumber, p]));
}
