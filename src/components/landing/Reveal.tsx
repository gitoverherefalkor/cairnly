import React, { useEffect, useRef } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'aside';
  style?: React.CSSProperties;
}

/**
 * Fade-up-on-scroll wrapper. Elements already in (or near) the viewport on
 * mount stay visible — only off-screen elements are armed and revealed as
 * they scroll into view, so the page never paints blank.
 */
const Reveal: React.FC<RevealProps> = ({ children, className = '', as = 'div', style }) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      el.classList.add('lp-reveal-in');
      return;
    }

    el.classList.add('lp-reveal-armed');
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.remove('lp-reveal-armed');
            e.target.classList.add('lp-reveal-in');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={`lp-reveal ${className}`} style={style}>
      {children}
    </Tag>
  );
};

export default Reveal;
