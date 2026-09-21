import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { escapeHtml, textToHtml, toPlainText } from './outreachHtml.ts';

Deno.test('escapeHtml escapes the ampersand first', () => {
  assertEquals(escapeHtml('a & <b> "c"'), 'a &amp; &lt;b&gt; &quot;c&quot;');
});

Deno.test('a markdown link becomes an anchor with its own label', () => {
  const html = textToHtml('Kijk naar de [demo van een sessie](https://cairnly.io/demo?a=1&b=2).');
  assertStringIncludes(html, '<a href="https://cairnly.io/demo?a=1&amp;b=2">demo van een sessie</a>');
  // The full stop stays outside the link.
  assertStringIncludes(html, '</a>.');
});

Deno.test('a bare URL still becomes a link, labelled with itself', () => {
  const html = textToHtml('Plannen kan via https://calendly.com/sjoerd/new-meeting');
  assertStringIncludes(html, '<a href="https://calendly.com/sjoerd/new-meeting">https://calendly.com/sjoerd/new-meeting</a>');
});

Deno.test('punctuation after a bare URL is not swallowed into the href', () => {
  const html = textToHtml('Zie https://cairnly.io/partners.');
  assertStringIncludes(html, '<a href="https://cairnly.io/partners">https://cairnly.io/partners</a>.');
});

Deno.test('line breaks survive, including the blank lines between paragraphs', () => {
  assertEquals(textToHtml('een\n\ntwee'), '<div dir="ltr">een<br><br>twee</div>');
});

Deno.test('the coach quote keeps its quotation marks and gains no markup', () => {
  const html = textToHtml('schreef me dit: "by far the best career tool"');
  assertStringIncludes(html, '&quot;by far the best career tool&quot;');
});

Deno.test('text that looks like a tag is escaped, not rendered', () => {
  const html = textToHtml('<script>alert(1)</script>');
  assertStringIncludes(html, '&lt;script&gt;');
  assertEquals(html.includes('<script>'), false);
});

Deno.test('toPlainText spells a markdown link out for a human', () => {
  assertEquals(
    toPlainText('de [demo](https://cairnly.io/demo) staat klaar'),
    'de demo: https://cairnly.io/demo staat klaar',
  );
});
