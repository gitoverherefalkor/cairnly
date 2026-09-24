// Sjoerd's Cairnly signature, verbatim from the first mail he sent to Step by
// Step Priority on 2026-09-21 (Gmail's own markup).
//
// Why it lives in code: a message sent through the Gmail API gets NO Gmail
// signature; only the web client adds one. Only the first mail carries it.
// Replies, chases and check-ins end on "Groet, Sjoerd" because the first
// mail, signature and all, sits right below them in the thread. That is how
// the hand-sent mails looked too.

export const SIGNATURE_HTML =
  '<span class="gmail_signature_prefix">-- </span><br>' +
  '<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div dir="ltr"><div dir="ltr">' +
  '<div style="color:rgb(34,34,34)"><b><font color="#45818e">Sjoerd Geurts </font></b></div>' +
  '<div><i><a href="http://www.cairnly.io" target="_blank"><font color="#bf9000">cairnly</font></a><font color="#222222"> - career path clarity.</font><br><br></i>' +
  '<img src="https://www.cairnly.io/logos/cairnly-wordmark-email.png" width="200" height="41"><br></div>' +
  '<div><br><font color="#222222">Book a call with me </font><a href="https://calendly.com/sjoerd-bethehitl/new-meeting" target="_blank"><font color="#45818e"><b>here</b></font></a></div>' +
  '<div><span style="color:rgb(32,33,36)">Or reach out via </span><font color="#bf9000"><a href="mailto:sjoerd@cairnly.io" target="_blank">sjoerd@cairnly.io</a></font> <font color="#134f5c" style="color:rgb(34,34,34)">|</font><font color="#222222" style="color:rgb(34,34,34)"> </font><a href="https://www.linkedin.com/in/sjoerdgeurts/" style="color:rgb(17,85,204);background-color:transparent" target="_blank"><font color="#bf9000">LinkedIn/sjoerdgeurts</font></a></div>' +
  '</div></div></div></div>';

export const SIGNATURE_TEXT = [
  '--',
  'Sjoerd Geurts',
  'cairnly - career path clarity.',
  '',
  'Book a call with me: https://calendly.com/sjoerd-bethehitl/new-meeting',
  'Or reach out via sjoerd@cairnly.io | https://www.linkedin.com/in/sjoerdgeurts/',
].join('\n');
