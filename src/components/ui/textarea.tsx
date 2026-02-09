import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);

    // This allows the parent component to get a ref to the textarea
    React.useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    // Adjust height based on content
    React.useLayoutEffect(() => {
      const textarea = internalRef.current;
      if (textarea) {
        textarea.style.height = 'auto'; // Reset height to calculate new scrollHeight correctly
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, [props.value]); // Re-run when the value changes programmatically

    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'resize-none overflow-y-hidden', // Add these classes for auto-sizing
          className
        )}
        ref={internalRef}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
