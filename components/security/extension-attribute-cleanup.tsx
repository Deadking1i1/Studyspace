const cleanupScript = String.raw`
(() => {
  const extensionAttribute = /^bis_/i;
  const clean = (root) => {
    if (!(root instanceof Element)) return;
    for (const attribute of Array.from(root.attributes)) {
      if (extensionAttribute.test(attribute.name)) root.removeAttribute(attribute.name);
    }
    for (const element of root.querySelectorAll("*")) {
      for (const attribute of Array.from(element.attributes)) {
        if (extensionAttribute.test(attribute.name)) element.removeAttribute(attribute.name);
      }
    }
  };

  clean(document.documentElement);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName && extensionAttribute.test(mutation.attributeName)) {
        mutation.target.removeAttribute(mutation.attributeName);
      }
      for (const node of mutation.addedNodes) clean(node);
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });
  window.setTimeout(() => observer.disconnect(), 10000);
})();
`;

/** Removes DOM bookkeeping attributes injected by security extensions before React hydrates. */
export function ExtensionAttributeCleanup() {
  return <Script id="extension-attribute-cleanup" strategy="beforeInteractive">{cleanupScript}</Script>;
}
import Script from "next/script";
