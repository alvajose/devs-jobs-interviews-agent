// DevLoversTeam/python-interview-questions, MIT. Spanish edition (README.es.md).
// Questions are `<details><summary>N. ¿Question?</summary> answer </details>` blocks.
export default {
  name: "python-devlovers",
  slug: "bank",
  stack: "python",
  kind: "question-bank",
  source: {
    repo: "DevLoversTeam/python-interview-questions",
    url: "https://github.com/DevLoversTeam/python-interview-questions",
    raw: "https://raw.githubusercontent.com/DevLoversTeam/python-interview-questions/main/README.es.md",
    license: "MIT",
    copyright: "Copyright (c) 2026 DevLovers",
  },
  parse(md) {
    const re = /<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
    const items = [];
    let m;
    while ((m = re.exec(md))) {
      const question = m[1].replace(/^\s*\d+\.\s*/, "").trim();
      const answer = m[2].trim();
      if (question && answer.length > 15) items.push({ question, answer });
    }
    return items;
  },

  // The repo is broad and skews junior in its early sections. Keep genuinely-asked
  // interview signal (how/when/why/difference/tradeoffs) plus a few advanced concepts
  // worth a definitional question; drop basic-method and definitional trivia.
  filter({ question }) {
    const q = question.toLowerCase();
    // Basic-syntax / string-list-method / setup noise, drop even if phrased as "how".
    const TRIVIA =
      /strip|`count`|`join`|`split`|`replace`|`pop`|`extend`|reverse|`sort`|`copy`|`get`|readline|readlines|`read\(|escape|módulo \(|división|`bool`|type casting|`pass`|ellipsis|\brepl\b|literals|keywords|docstring|cuántos espacios|caracteres de escape|`dir\(|sys\.argv|getrefcount|dirección de memoria|crear un .?`?tuple|unir dos listas|mezclar elementos|`min`|`max`|`sum`|requirements\.txt|`pip`|entorno virtual|importar un módulo|tipos de imports|función `dir`|variable en python|módulos integrados|`random`|operador módulo/;
    if (TRIVIA.test(q)) return false;
    // Advanced concepts worth keeping even as "what is X".
    const CONCEPT =
      /\bgil\b|\bmro\b|descriptor|asyncio|bucle de eventos|event loop|dataclass|pydantic|decorador|generador|\bmixin|protocol|typeddict|genéricos|`?property`?|__slots__|\bslots\b|contextvars|lru_cache|recolección de basura|gestor de contexto|\basync\b|\bawait\b|encapsulación|polimorfismo|herencia múltiple|abstracción|\btdd\b|magic method|dunder|metaclase|hashable|hash function|gestiona python la memoria|conteo de referencias/;
    if (CONCEPT.test(q)) return true;
    // General interview signal: how/when/why/difference/tradeoffs.
    const SIGNAL =
      /^(¿?cómo|¿?cuándo|¿?por qué|¿?en qué se diferencia|¿?cuál es la diferencia|¿?qué diferencia|explique|explica|describa|describe)/;
    if (SIGNAL.test(q) && /diferencia|optimiz|rendimiento|memoria|concurren|paralel|afecta|garantizar|prevenir|manejar|eficien|ventajas y desventajas|conviene|arquitectura|estructura de un proyecto|seguridad/.test(q))
      return true;
    return false;
  },
};
