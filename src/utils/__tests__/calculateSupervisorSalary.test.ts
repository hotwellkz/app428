import { describe, expect, it } from 'vitest';
import { calculateSupervisorSalary } from '../calculateSupervisorSalary';

describe('calculateSupervisorSalary', () => {
  it('area=50 => 119_318 (контрольное значение, шкала 120→150k)', () => {
    expect(calculateSupervisorSalary(50)).toBe(119_318);
  });

  it('area=100 => 136_364 (контрольное значение)', () => {
    expect(calculateSupervisorSalary(100)).toBe(136_364);
  });

  it('area=120 => 150_000 (обязательный якорь)', () => {
    expect(calculateSupervisorSalary(120)).toBe(150_000);
  });

  it('area=122 => больше 150_000 и отличается от результата для 120', () => {
    const pay120 = calculateSupervisorSalary(120)!;
    const pay122 = calculateSupervisorSalary(122)!;
    expect(pay120).toBe(150_000);
    expect(pay122).toBeGreaterThan(150_000);
    expect(pay122).not.toBe(pay120);
    expect(pay122).toBe(150_795); // 120–150: интерполяция
  });

  it('area=1500 => 596_591 (обязательный якорь)', () => {
    expect(calculateSupervisorSalary(1500)).toBe(596_591);
  });

  it('area=30 => 102_273 (минимальный якорь)', () => {
    expect(calculateSupervisorSalary(30)).toBe(102_273);
  });

  it('area < минимального якоря => pay минимального якоря (102_273)', () => {
    expect(calculateSupervisorSalary(29)).toBe(102_273);
    expect(calculateSupervisorSalary(0)).toBe(102_273);
  });

  it('градиент 1500–2000: 1600, 1750, 2000', () => {
    expect(calculateSupervisorSalary(1600)).toBe(613_636);
    expect(calculateSupervisorSalary(1750)).toBe(639_205);
    expect(calculateSupervisorSalary(2000)).toBe(681_818);
  });

  it('1999 м² меньше 681_818 (интерполяция до 2000)', () => {
    const pay1999 = calculateSupervisorSalary(1999)!;
    expect(pay1999).toBeLessThan(681_818);
    expect(pay1999).toBe(681_648);
  });

  it('площадь больше 2000 ограничивается 2000 => 681_818', () => {
    expect(calculateSupervisorSalary(2001)).toBe(681_818);
    expect(calculateSupervisorSalary(3000)).toBe(681_818);
  });

  it('линейная интерполяция между якорями: 40 между 30 и 50 => 110_796', () => {
    expect(calculateSupervisorSalary(40)).toBe(110_796);
  });

  it('возвращает целое число (Math.round)', () => {
    const result = calculateSupervisorSalary(35);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(106_534);
  });

  it('возвращает null только для NaN', () => {
    expect(calculateSupervisorSalary(NaN)).toBeNull();
  });
});
