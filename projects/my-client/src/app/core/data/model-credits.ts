/**
 * Ghi nguồn cho mô hình 3D dùng giấy phép yêu cầu attribution (vd CC BY 4.0), tra theo tên file
 * trong Product.modelUrl. Xem thêm assets/models/products/CREDITS.md.
 */
const MODEL_CREDITS: Record<string, string> = {
  'glam-velvet-sofa.glb': 'Mô hình 3D: “Glam Velvet Sofa” — Eric Chadwick, © 2021 Wayfair LLC, CC BY 4.0',
  'sheen-chair.glb': 'Mô hình 3D: “Sheen Chair” — Eric Chadwick, © 2020 Wayfair LLC, CC0',
};

export function modelCreditFor(modelUrl: string | null | undefined): string | null {
  if (!modelUrl) return null;
  const file = modelUrl.split(/[?#]/)[0].split('/').pop() ?? '';
  return MODEL_CREDITS[file] ?? null;
}
