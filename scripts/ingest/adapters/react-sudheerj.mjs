import { dedent } from "../core.mjs";

// sudheerj/reactjs-interview-questions, MIT. Questions look like `N. ### Question?` and the
// answer runs until the `**[⬆ Back to Top]` marker.
export default {
  name: "react-sudheerj",
  slug: "bank",
  stack: "react",
  kind: "question-bank",
  source: {
    repo: "sudheerj/reactjs-interview-questions",
    url: "https://github.com/sudheerj/reactjs-interview-questions",
    raw: "https://raw.githubusercontent.com/sudheerj/reactjs-interview-questions/master/README.md",
    license: "MIT",
    copyright: "Copyright (c) 2017-Present Sudheer Jonna",
  },
  parse(md) {
    const qRe = /^[ \t]*\d+\.\s+###\s+(.+?)\s*$/gm;
    const matches = [...md.matchAll(qRe)];
    const items = [];
    for (let i = 0; i < matches.length; i++) {
      const question = matches[i][1].trim();
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
      let chunk = md.slice(start, end);
      const cut = chunk.indexOf("**[⬆ Back to Top]");
      if (cut !== -1) chunk = chunk.slice(0, cut);
      const answer = dedent(chunk).trim();
      if (question && answer.length > 15) items.push({ question, answer });
    }
    return items;
  },

  // Keep only high-signal questions: drop legacy/outdated topics and pure definitional
  // trivia, keep architecture/design/scenario ("how/when/why/difference") plus a few
  // core modern concepts worth a definitional question.
  filter({ question }) {
    const q = question.toLowerCase();
    const LEGACY =
      /mixin|polymer|\brelay\b|react native|redux-?saga|redux-?form|react intl|jasmine|proptype|router v4|history library|history behind|advantages of react|limitations of react|what is flux|\bflow\b|font awesome|google analytics|vendor prefix|pretty print|innerhtml|registerserviceworker|fiber|shadow dom|switching component|\bmvw\b|rxjs|styled components|web components|relay/;
    if (LEGACY.test(q)) return false;
    const SIGNAL =
      /^(how would|how do you|how to (optimize|handle|prevent|ensure|debug|structure|reset)|when (would|to|should)|why (would|does|is|are|can)|what.?s the difference|difference between|explain)/;
    if (SIGNAL.test(q)) return true;
    const CORE =
      /reconciliation|virtual dom|\bkeys?\b|controlled component|uncontrolled component|error boundar|code.?splitting|suspense|\blazy\b|\bmemo\b|usecallback|usememo|usereducer|context|\bhooks?\b|\bportal|fragment|\brefs?\b|render props|higher.?order|pure component/;
    if (/^(what is|what are)\b/.test(q) && CORE.test(q)) return true;
    return false;
  },
};
