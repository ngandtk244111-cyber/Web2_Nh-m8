import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Room } from '../models/room.model';
import { Product } from '../models/product.model';
import { ProductService } from './product.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/rooms`;

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private http = inject(HttpClient);

  private roomsSignal = signal<Room[]>([]);
  private activeRoomIdSignal = signal<string>('');

  readonly rooms = this.roomsSignal.asReadonly();
  readonly activeRoomId = this.activeRoomIdSignal.asReadonly();

  constructor(private productService: ProductService) {
    this.refresh();
  }

  refresh(): void {
    this.http.get<{ success: boolean; rooms: Room[] }>(BASE).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.roomsSignal.set(res.rooms);
        if (!this.activeRoomIdSignal() && res.rooms.length > 0) {
          this.activeRoomIdSignal.set(res.rooms[0].id);
        }
      },
      error: (err) => console.warn('Failed to load rooms', err),
    });
  }

  getActiveRoom(): Room | undefined {
    const id = this.activeRoomIdSignal();
    return this.roomsSignal().find(r => r.id === id) || this.roomsSignal()[0];
  }

  getRoomById(id: string): Room | undefined {
    return this.roomsSignal().find(r => r.id === id);
  }

  setActiveRoom(id: string): void {
    if (this.roomsSignal().some(r => r.id === id)) {
      this.activeRoomIdSignal.set(id);
    }
  }

  getProductsInRoom(room: Room): Product[] {
    const productIds = room.hotspots.map(h => h.productId);
    return productIds
      .map(id => this.productService.getProductById(id))
      .filter((p): p is Product => p !== undefined);
  }
}
