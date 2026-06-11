import { assert } from './assert';

export function select<T extends Element>(
  selector: string,
  type: { new (): T; prototype: T },
  root: ParentNode = document,
): T {
  const el = root.querySelector(selector);
  assert(el, `No element matching '${selector}'`);
  assert(el instanceof type, `Element '${selector}' is not a ${type.name}`);
  return el;
}
