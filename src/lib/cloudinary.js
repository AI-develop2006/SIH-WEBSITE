export async function uploadToCloudinary(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "e6dwxxzs";
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "sih_avatars";

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return { url: null, error: "Please select an image file" };
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, error: "Image size must be less than 5MB" };
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "sih_avatars");

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { url: null, error: errorData.error?.message || "Upload failed" };
    }

    const data = await response.json();
    return { url: data.secure_url, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : "Upload failed" };
  }
}
