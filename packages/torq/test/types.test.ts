import { describe, it, expect } from 'vitest';
import * as torq from '../src/index.ts';

describe('torq types and exports', () => {
  it('exports torq types module', () => {
    expect(torq).toBeDefined();
  });
});
