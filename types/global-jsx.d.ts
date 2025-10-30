// Fallback JSX namespace to satisfy libraries that reference JSX directly
// This is safe as React 17+ provides proper JSX types; this serves as a minimal shim
// for packages that expect a global JSX namespace during type checking.
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface ElementChildrenAttribute {
    children: {};
  }
}