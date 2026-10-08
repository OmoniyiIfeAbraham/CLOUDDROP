export const buildObjectKey = (
  userId: string,
  fileId: string,
  originalName: string
): string => {
  const safeName = originalName.replace(/[/\\]/g, "_");
  return `users/${userId}/files/${fileId}/${safeName}`;
};
