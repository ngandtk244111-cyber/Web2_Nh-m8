import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
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

  create(data: Partial<Room>): Observable<Room> {
    return this.http.post<{ success: boolean; room: Room }>(BASE, data).pipe(
      map(res => res.room),
      tap(room => this.roomsSignal.update(list => [...list, room]))
    );
  }

  update(id: string, data: Partial<Room>): Observable<Room> {
    return this.http.put<{ success: boolean; room: Room }>(`${BASE}/${encodeURIComponent(id)}`, data).pipe(
      map(res => res.room),
      tap(room => this.roomsSignal.update(list => list.map(r => r.id === id ? room : r)))
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`).pipe(
      map(() => undefined),
      tap(() => this.roomsSignal.update(list => list.filter(r => r.id !== id)))
    );
  }
}
