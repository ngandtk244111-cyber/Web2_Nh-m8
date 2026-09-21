import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'vnd',
  standalone: true
})
export class VndPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) return '0đ';
    return value.toLocaleString('vi-VN') + 'đ';
  }
}
