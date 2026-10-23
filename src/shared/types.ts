export interface Frame { id: string; name: string; model: string; thumb: string; }
  // id "frame-01".."frame-05"; model "/assets/frames/frame-01.glb"; thumb "/assets/thumbs/frame-01.png"
export interface Furniture { id: string; name: string; category: "furniture" | "decor"; model: string; thumb: string; size: { w: number; h: number; d: number }; }
  // id "item-01".."item-05"; model "/assets/furniture/item-01.glb"; size in real-world meters
export interface TryOnEngine { start(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void>; stop(): void; setFrame(frame: Frame): Promise<void>; }
export interface ArEngine { isSupported(): Promise<boolean>; start(host: HTMLElement, overlay: HTMLElement): Promise<void>; stop(): void; setModel(item: Furniture): Promise<void>; }
  // overlay = DOM-overlay root for in-AR buttons
