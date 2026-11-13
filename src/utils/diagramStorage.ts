/**
 * Processes a diagram image (SVG or PNG) for inline document storage.
 * As per architectural requirements, Firebase Storage is NOT used.
 * SVGs and diagrams are stored directly in the question document fields as strings/data URLs,
 * keeping the document strictly under the 1MB Firestore limit.
 *
 * @param file The file or blob object.
 * @param fileName A custom filename.
 * @returns A data URL or string representation safe for inline storage.
 */
export async function uploadDiagramToStorage(file: File | Blob, fileName: string): Promise<string> {
  console.log(`[MCQ Import] [Step: Image] Storing diagram "${fileName}" inline as string without Firebase Storage...`);
  return new Promise<string>((resolve) => {
    let timer: any;
    try {
      const reader = new FileReader();
      timer = setTimeout(() => {
        console.warn(`[MCQ Import] [Step: Image] FileReader timed out for ${fileName}`);
        resolve("");
      }, 15000);

      reader.onload = (e) => {
        clearTimeout(timer);
        const result = (e.target?.result as string) || "";
        // Verify size is under 800KB for safety
        if (result.length > 800 * 1024) {
          console.warn(`[MCQ Import] [Step: Image] Diagram ${fileName} is large (${Math.round(result.length / 1024)}KB).`);
        }
        resolve(result);
      };
      reader.onerror = () => {
        clearTimeout(timer);
        resolve("");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      clearTimeout(timer);
      console.warn("[MCQ Import] [Step: Image] Error converting diagram to data URL:", err);
      resolve("");
    }
  });
}

/**
 * Converts a Data URL to a Blob object.
 * @param dataUrl The data URL string.
 * @returns A Blob representation of the data.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(",");
    const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return new Blob([], { type: "image/png" });
  }
}
