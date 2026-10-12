import { describe, it, expect } from 'vitest';
import { resolveDefaultCollege, type CollegeLite } from './scope';

describe('scope (college admin fixed, super admin cookie)', () => {
  const colleges: CollegeLite[] = [
    { id: 'col-1', name: 'IIT Delhi', short_code: 'IITD', active: true },
    { id: 'col-2', name: 'IIT Kanpur', short_code: 'IITK', active: true },
    { id: 'col-3', name: 'IIT Bombay', short_code: 'IITB', active: true },
  ];

  it('selects preferred college when preferredId matches', () => {
    const selected = resolveDefaultCollege(colleges, 'col-3');
    expect(selected.id).toBe('col-3');
    expect(selected.short_code).toBe('IITB');
  });

  it('defaults to IITK if preferredId is missing', () => {
    const selected = resolveDefaultCollege(colleges, null);
    expect(selected.id).toBe('col-2');
    expect(selected.short_code).toBe('IITK');
  });

  it('defaults to IITK if preferredId is not in list', () => {
    const selected = resolveDefaultCollege(colleges, 'col-unknown');
    expect(selected.id).toBe('col-2');
    expect(selected.short_code).toBe('IITK');
  });

  it('falls back to first college if IITK is not in list and preferredId is missing', () => {
    const otherColleges: CollegeLite[] = [
      { id: 'c-a', name: 'College A', short_code: 'CA', active: true },
      { id: 'c-b', name: 'College B', short_code: 'CB', active: true },
    ];
    const selected = resolveDefaultCollege(otherColleges, null);
    expect(selected.id).toBe('c-a');
  });

  it('handles empty colleges list safely', () => {
    const selected = resolveDefaultCollege([]);
    expect(selected.id).toBe('');
    expect(selected.short_code).toBe('—');
  });
});
