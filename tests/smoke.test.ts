import { describe, it, expect } from 'vitest';

describe('vitest harness', () => {
  it('executes a trivial test to prove the test runner is wired up', () => {
    expect(1 + 1).toBe(2);
  });
});
