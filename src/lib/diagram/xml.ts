/**
 * A small XML reader for files written by tools (draw.io), which are well-formed: elements, attributes, text,
 * comments, CDATA and the standard entities. Not a validating parser. Written here rather than using DOMParser
 * so imports work the same in the browser and in tests (which run in Node).
 */

export interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  /** The element's own text, joined (draw.io keeps compressed pages here). */
  text: string;
}

// nbsp isn't an XML entity, but draw.io's HTML labels use it once the attribute is decoded.
const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: "\u00a0" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const ATTRIBUTE = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

/** Parses a document and returns its root element; throws on text that isn't XML at all. */
export function parseXml(source: string): XmlElement {
  const root: XmlElement = { name: "#document", attributes: {}, children: [], text: "" };
  const stack: XmlElement[] = [root];
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("<", index);
    const current = stack[stack.length - 1];
    if (open === -1) {
      current.text += decodeEntities(source.slice(index));
      break;
    }
    if (open > index) current.text += decodeEntities(source.slice(index, open));
    if (source.startsWith("<!--", open)) {
      const end = source.indexOf("-->", open);
      index = end === -1 ? source.length : end + 3;
    } else if (source.startsWith("<![CDATA[", open)) {
      const end = source.indexOf("]]>", open);
      current.text += source.slice(open + 9, end === -1 ? source.length : end);
      index = end === -1 ? source.length : end + 3;
    } else if (source.startsWith("<?", open) || source.startsWith("<!", open)) {
      const end = source.indexOf(">", open);
      index = end === -1 ? source.length : end + 1;
    } else if (source.startsWith("</", open)) {
      const end = source.indexOf(">", open);
      if (stack.length > 1) stack.pop();
      index = end === -1 ? source.length : end + 1;
    } else {
      // Attribute values may contain ">", so find the tag's end outside quotes.
      let end = open + 1;
      let quote: string | null = null;
      for (; end < source.length; end++) {
        const char = source[end];
        if (quote) {
          if (char === quote) quote = null;
        } else if (char === '"' || char === "'") quote = char;
        else if (char === ">") break;
      }
      if (end >= source.length) throw new Error("Unclosed tag");
      const tag = source.slice(open + 1, end);
      const selfClosing = tag.endsWith("/");
      const name = /^[^\s/>]+/.exec(tag)?.[0];
      if (!name) throw new Error("Malformed tag");
      const attributes: Record<string, string> = {};
      for (const match of tag.slice(name.length).matchAll(ATTRIBUTE)) {
        attributes[match[1]] = decodeEntities(match[3] ?? match[4] ?? "");
      }
      const element: XmlElement = { name, attributes, children: [], text: "" };
      current.children.push(element);
      if (!selfClosing) stack.push(element);
      index = end + 1;
    }
  }
  const element = root.children[0];
  if (!element) throw new Error("No root element");
  return element;
}

/** Every descendant element with this name, in document order. */
export function findAll(element: XmlElement, name: string): XmlElement[] {
  return element.children.flatMap((child) => [...(child.name === name ? [child] : []), ...findAll(child, name)]);
}
