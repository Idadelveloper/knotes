import type { AriaAttributes, DOMAttributes } from 'react';

// Allow the special "as" attribute on intrinsic elements (e.g., <div as={MessageInput} />)
// used by @chatscope/chat-ui-kit-react to slot custom wrappers.
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    // Using `any` here avoids importing component types into the global ambient declaration.
    as?: string | any;
  }
}
