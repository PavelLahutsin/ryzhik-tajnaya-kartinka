export type Child = Node | string | null | undefined | false;

export type ElProps = {
  class?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  on?: Record<string, EventListener>;
  style?: Record<string, string>;
};

/** Small element helper. No framework, no virtual DOM. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.attrs) {
    for (const [key, value] of Object.entries(props.attrs)) {
      if (value === null || value === undefined || value === false) continue;
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  if (props.style) {
    for (const [key, value] of Object.entries(props.style)) {
      if (key.startsWith("--")) node.style.setProperty(key, value);
      else (node.style as unknown as Record<string, string>)[key] = value;
    }
  }
  if (props.on) {
    for (const [event, listener] of Object.entries(props.on)) {
      node.addEventListener(event, listener);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}
