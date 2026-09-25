import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Order } from '../../core/models/order.model';
import { AppIconComponent } from '../icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { VnProvince, findProvince } from './vn-provinces';

export type LumeaMapMode = 'orders' | 'network';

export interface MapSupplier {
  name: string;
  address: string;
  category?: string;
  contact?: string;
  phone?: string;
  rating?: number;
  active?: boolean;
}

export interface ProvinceOrderStat {
  province: VnProvince;
  orders: Order[];
  revenue: number;
  printCount: number;
}

export interface NetworkSite {
  kind: 'showroom' | 'supplier';
  name: string;
  address: string;
  detail: string;
  contact?: string;
  phone?: string;
  lat: number;
  lng: number;
}

/** Escape nội dung đưa vào tooltip (Leaflet hiểu chuỗi là HTML). */
const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (text: string) => text.replace(/[&<>"']/g, c => HTML_ENTITIES[c]);

/** Khung nhìn bao trọn lãnh thổ Việt Nam. */
const VN_BOUNDS: L.LatLngBoundsExpression = [[8.4, 102.1], [23.4, 109.6]];

const COLOR = {
  rust: '#A3152D',
  orange: '#B7485B',
  espresso: '#1F1712',
  cream: '#FBF8F1',
};

/**
 * Bản đồ Luméa trên Dashboard — ý tưởng từ dashboard-vn-map của my-admin-vita:
 *  - "Đơn hàng theo tỉnh": vòng tròn theo số đơn, bấm để xem doanh thu & danh sách đơn.
 *  - "Mạng lưới Luméa": showroom + xưởng/đối tác cung ứng theo địa chỉ.
 * Leaflet chạy ngoài Angular zone, chỉ quay lại zone khi người dùng bấm chọn.
 */
@Component({
  selector: 'app-lumea-map',
  standalone: true,
  imports: [CommonModule, AppIconComponent, VndPipe],
  templateUrl: './lumea-map.component.html',
})
export class LumeaMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() orders: Order[] = [];
  @Input() suppliers: MapSupplier[] = [];
  @Input() showroomAddress = '';
  @Output() orderSelect = new EventEmitter<Order>();

  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);

  // Mặc định xem mạng lưới (luôn có dữ liệu showroom/xưởng); đơn hàng có thể chưa có
  mode: LumeaMapMode = 'network';
  provinceStats: ProvinceOrderStat[] = [];
  unmatchedOrders = 0;
  sites: NetworkSite[] = [];
  selectedStat: ProvinceOrderStat | null = null;
  selectedSite: NetworkSite | null = null;

  private map: L.Map | null = null;
  private layer: L.LayerGroup | null = null;
  private resizeObserver: ResizeObserver | null = null;

  get maxOrders(): number {
    return this.provinceStats[0]?.orders.length || 1;
  }

  ngOnChanges(): void {
    this.buildOrderStats();
    this.buildSites();
    if (this.selectedStat) {
      this.selectedStat = this.provinceStats.find(s => s.province === this.selectedStat!.province) || null;
    }
    this.renderMarkers();
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.map = L.map(this.mapHost.nativeElement, {
        scrollWheelZoom: false,
        zoomSnap: 0.25,
        attributionControl: true,
      });
      this.map.fitBounds(VN_BOUNDS);
      // Tile OpenStreetMap chuẩn (giống my-admin-vita) — không cần API key
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(this.map);
      this.layer = L.layerGroup().addTo(this.map);

      // Sidebar thu gọn/mở rộng làm đổi kích thước khung → báo Leaflet vẽ lại
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(this.mapHost.nativeElement);
    });
    this.renderMarkers();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  setMode(mode: LumeaMapMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.selectedStat = null;
    this.selectedSite = null;
    this.renderMarkers();
    this.map?.flyToBounds(VN_BOUNDS, { duration: 0.6 });
  }

  selectStat(stat: ProvinceOrderStat | null): void {
    this.selectedStat = stat;
    this.renderMarkers();
    if (stat) this.map?.flyTo([stat.province.lat, stat.province.lng], 9, { duration: 0.6 });
    else this.map?.flyToBounds(VN_BOUNDS, { duration: 0.6 });
  }

  selectSite(site: NetworkSite | null): void {
    this.selectedSite = site;
    this.renderMarkers();
    if (site) this.map?.flyTo([site.lat, site.lng], 11, { duration: 0.6 });
    else this.map?.flyToBounds(VN_BOUNDS, { duration: 0.6 });
  }

  directionsUrl(address: string): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  }

  statusLabel(status: Order['status']): string {
    switch (status) {
      case 'PENDING': return 'Chờ gọi xác nhận';
      case 'CONFIRMED': return 'Chờ giao';
      case 'IN_PRODUCTION': return 'Đang in 3D';
      case 'SHIPPED': return 'Đang giao';
      case 'DELIVERED': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      case 'RETURNED': return 'Hoàn hàng';
    }
  }

  // ---------------------------------------------------------------- data

  private buildOrderStats(): void {
    const byProvince = new Map<VnProvince, ProvinceOrderStat>();
    let unmatched = 0;
    for (const o of this.orders) {
      const a = o.shippingAddress;
      const province = findProvince(`${a?.city || ''} ${a?.district || ''}`);
      if (!province) { unmatched++; continue; }
      const stat = byProvince.get(province) || { province, orders: [], revenue: 0, printCount: 0 };
      stat.orders.push(o);
      stat.revenue += o.total || 0;
      if (o.hasPrintOnDemandItems) stat.printCount++;
      byProvince.set(province, stat);
    }
    this.provinceStats = [...byProvince.values()].sort((a, b) => b.orders.length - a.orders.length);
    this.unmatchedOrders = unmatched;
  }

  private buildSites(): void {
    const sites: NetworkSite[] = [];
    const showroom = findProvince(this.showroomAddress);
    if (showroom) {
      sites.push({
        kind: 'showroom',
        name: 'Showroom Luméa',
        address: this.showroomAddress,
        detail: 'Trưng bày sản phẩm & tư vấn thiết kế',
        lat: showroom.lat,
        lng: showroom.lng,
      });
    }
    for (const s of this.suppliers) {
      if (s.active === false) continue;
      const p = findProvince(s.address);
      if (!p) continue;
      sites.push({
        kind: 'supplier',
        name: s.name,
        address: s.address,
        detail: s.category || 'Đối tác cung ứng',
        contact: s.contact,
        phone: s.phone,
        lat: p.lat,
        lng: p.lng,
      });
    }
    // Nhiều điểm cùng tỉnh → xếp vòng quanh tâm tỉnh để không chồng lên nhau
    const perProvince = new Map<string, NetworkSite[]>();
    for (const site of sites) {
      const key = `${site.lat},${site.lng}`;
      perProvince.set(key, [...(perProvince.get(key) || []), site]);
    }
    for (const group of perProvince.values()) {
      if (group.length < 2) continue;
      group.forEach((site, i) => {
        const angle = (2 * Math.PI * i) / group.length;
        site.lat += 0.22 * Math.sin(angle);
        site.lng += 0.22 * Math.cos(angle);
      });
    }
    this.sites = sites;
  }

  // ---------------------------------------------------------------- map

  private renderMarkers(): void {
    const layer = this.layer;
    if (!layer) return;
    this.zone.runOutsideAngular(() => {
      layer.clearLayers();
      if (this.mode === 'orders') {
        for (const stat of this.provinceStats) {
          const selected = stat === this.selectedStat;
          const radius = 9 + Math.sqrt(stat.orders.length / this.maxOrders) * 22;
          L.circleMarker([stat.province.lat, stat.province.lng], {
            radius,
            color: selected ? COLOR.espresso : COLOR.rust,
            weight: selected ? 3 : 1.5,
            fillColor: COLOR.orange,
            fillOpacity: selected ? 0.75 : 0.45,
          })
            .bindTooltip(`<strong>${esc(stat.province.name)}</strong><br>${stat.orders.length} đơn`, { className: 'lumea-map-tip', direction: 'top' })
            .on('click', () => this.zone.run(() => this.selectStat(stat)))
            .addTo(layer);
        }
      } else {
        for (const site of this.sites) {
          const selected = site === this.selectedSite;
          const isShowroom = site.kind === 'showroom';
          L.circleMarker([site.lat, site.lng], {
            radius: isShowroom ? 11 : 8,
            color: selected ? COLOR.espresso : COLOR.cream,
            weight: selected ? 3 : 2,
            fillColor: isShowroom ? COLOR.rust : COLOR.orange,
            fillOpacity: 1,
          })
            .bindTooltip(`<strong>${esc(site.name)}</strong><br>${esc(site.detail)}`, { className: 'lumea-map-tip', direction: 'top' })
            .on('click', () => this.zone.run(() => this.selectSite(site)))
            .addTo(layer);
        }
      }
    });
  }
}
