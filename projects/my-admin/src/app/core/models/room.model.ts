export interface RoomHotspot {
  id: string;
  productId: string;
  label: string;
  position: [number, number, number]; // 3D coordinates [x, y, z] in the room
  annotationNote: string;
}

export interface Room {
  id: string;
  name: string;
  theme: string;
  tagline: string;
  description: string;
  coverImage: string;
  cameraInitial: {
    x: number;
    y: number;
    z: number;
    fov: number;
  };
  /** Điểm camera nhìn vào lúc đầu + khi bấm "Góc nhìn chuẩn". Không set thì mặc định (0, 0.6, 0). */
  cameraLookAt?: [number, number, number];
  /** true: khoá vị trí camera tại chỗ, chỉ cho xoay nhìn quanh (walkthrough) thay vì xoay quỹ đạo quanh 1 điểm. */
  walkthroughMode?: boolean;
  /** true: mở khoá hoàn toàn (khoảng cách xa, xoay dọc tự do) để tự bay khám phá tìm góc đẹp — chỉ dùng tạm khi đang canh chỉnh, không dùng cho bản chính thức. */
  freeExploreMode?: boolean;
  roomType: 'minimal_study' | 'cozy_bedroom' | 'glb_scene';
  /** Chỉ dùng khi roomType = 'glb_scene': đường dẫn tới file .glb thật trong assets/models. */
  modelUrl?: string;
  /**
   * Chỉ dùng khi roomType = 'glb_scene': vùng toạ độ gốc (chưa scale) chứa khu vực nội thất
   * chính, dùng để canh giữa + scale thay vì lấy theo toàn bộ file (có thể lẫn hình khối
   * kiến trúc/ngoại thất ở rất xa làm sai tỉ lệ). Không set thì dùng bounding box toàn bộ model.
   */
  modelFocusBounds?: { min: [number, number, number]; max: [number, number, number] };
  hotspots: RoomHotspot[];
  totalLookPrice?: number;
}
