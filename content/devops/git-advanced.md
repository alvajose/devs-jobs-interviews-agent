---
stack: devops
id: devops-git-advanced
title: "Git avanzado: historial, bisección y recuperación"
area: Herramientas
priority: high
resourceLabel: Pro Git Book
resourceUrl: https://git-scm.com/book/en/v2
---

## Summary

Cómo reescribir historial con criterio (rebase vs. merge), encontrar el commit exacto que rompió algo con bisect, y recuperar trabajo "perdido" o sacar un secreto filtrado del historial sin romper el repo del equipo.

## Concepts

### Rebase vs. merge

#### Details

Ambos comandos resuelven el mismo problema,integrar cambios de una rama en otra, pero producen historiales completamente distintos. `git merge` crea un nuevo commit de merge que tiene dos padres, preservando exactamente cómo ocurrieron los hechos: qué commits existían en cada rama y cuándo se unieron. El historial resultante es no lineal pero 100% fiel a la realidad.

`git rebase` en cambio **reescribe** la rama actual: toma cada commit de tu rama, uno por uno, y los vuelve a aplicar como commits nuevos (con hashes distintos) sobre la punta de la rama destino, como si tu trabajo hubiera empezado ahí desde el principio. El resultado es un historial lineal, más fácil de leer con `git log`, pero que ya no refleja la cronología real: los commits originales fueron reemplazados por copias con distinto hash.

Ahí está la regla de oro que cualquier entrevistador espera: **nunca rebasees una rama que ya empujaste y que otros pueden haber basado su trabajo en ella**. Como el rebase cambia los hashes de los commits, si alguien más ya bajó esa rama y agregó commits propios encima, un rebase (con el consiguiente `push --force`) le deja a esa persona un historial divergente e irreconciliable sin recurrir a comandos de recuperación. La guía práctica de la documentación oficial es la "regla del rebase dorada": rebaseá libremente ramas locales que solo vos usás; para ramas compartidas, usá merge.

#### Examples

Merge, preserva la rama de feature como historial paralelo con un commit de merge

```bash
git checkout main
git merge feature/checkout
# crea un commit con dos padres: main y feature/checkout
```

Rebase, reescribe feature/checkout para que parezca lineal sobre main

```bash
git checkout feature/checkout
git rebase main
# los commits de feature/checkout se reaplican con hashes nuevos sobre main
git checkout main
git merge feature/checkout   # fast-forward, sin commit de merge extra
```

Ver la diferencia de forma de historial

```bash
git log --oneline --graph --all
```

#### Sources

- [Pro Git, Git Branching: Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing)
- [Git, git-rebase Documentation](https://git-scm.com/docs/git-rebase)

### Interactive rebase: squash, reorder y edit

#### Details

`git rebase -i <base>` abre un editor con la lista de commits desde `<base>` hasta la punta de la rama, cada uno con un comando (`pick` por defecto) que podés cambiar. Es la herramienta para limpiar historial ANTES de compartirlo: convertir una serie de commits de trabajo-en-progreso ("wip", "fix typo", "otro intento") en una secuencia de commits coherentes y bien mensajeados, que es lo que idealmente ve un reviewer en un pull request.

Las operaciones más usadas son `squash` (fusiona un commit con el anterior, combinando sus mensajes) y `fixup` (igual que squash pero descarta el mensaje del commit fusionado, útil para un "arreglo" de un commit previo que no merece su propio mensaje), `reword` (cambiar solo el mensaje sin tocar el contenido), `edit` (pausar en ese commit para modificar su contenido, por ejemplo separarlo en dos), y reordenar líneas para cambiar el orden en que se aplican los commits.

El caso de uso real más frecuente en equipos: antes de abrir o actualizar un PR, hacer `git rebase -i` sobre los commits propios para squashear el ruido de iteración en 1-3 commits lógicos, cada uno representando una unidad de cambio completa y revisable. Esto es distinto del "nunca rebasees ramas compartidas": acá se rebasea la rama de feature propia, todavía no integrada, antes de que otros dependan de ella.

#### Examples

Abrir rebase interactivo para los últimos 4 commits

```bash
git rebase -i HEAD~4
```

Lista que aparece en el editor, cambiando pick por squash/fixup

```
pick a1b2c3d feat: agregar endpoint de checkout
squash e4f5g6h wip
fixup h7i8j9k typo
reword k0l1m2n feat: agregar validación de stock
```

Reordenar commits (mover una línea antes que otra) y luego editar contenido de uno

```
pick e4f5g6h feat: validación de stock
edit a1b2c3d feat: endpoint de checkout
```

```bash
# al llegar al commit marcado con "edit", rebase pausa ahí:
git rebase --edit-todo   # o hacer los cambios y luego:
git add .
git commit --amend
git rebase --continue
```

#### Sources

- [Pro Git, Git Tools: Rewriting History](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History)
- [Git, git-rebase Documentation](https://git-scm.com/docs/git-rebase)

### `git bisect`: búsqueda binaria del commit culpable

#### Details

Cuando sabés que un bug existe hoy pero no en algún punto del pasado, revisar commit por commit manualmente es lineal en el peor caso, `git bisect` lo convierte en búsqueda binaria: le decís un commit `bad` (donde el bug existe) y uno `good` (donde no existe), y bisect va parando en el punto medio del rango, pidiéndote que marques cada uno como `good` o `bad` hasta converger en el commit exacto que introdujo el problema. Para un rango de miles de commits, esto reduce el trabajo de miles de verificaciones a un puñado (log₂ del tamaño del rango).

El uso más productivo es `git bisect run <script>`, que automatiza todo el proceso: le pasás un script o comando que devuelve código de salida 0 si el estado es bueno y distinto de 0 si es malo (por ejemplo, correr un test específico que falla solo cuando el bug está presente), y bisect hace el checkout, corre el script, interpreta el resultado y continúa solo, sin intervención manual, hasta señalar el commit exacto.

El punto de entrevista senior es entender que bisect no reemplaza el debugging, lo acelera: te da el commit sospechoso, pero seguís necesitando leer ese diff y entender POR QUÉ ese cambio rompió algo. También es clave marcar bien el rango: si el `good` inicial en realidad ya tenía el bug de forma más sutil, bisect converge al lugar equivocado.

#### Examples

Bisect manual

```bash
git bisect start
git bisect bad                 # HEAD tiene el bug
git bisect good v1.4.0          # esta versión no lo tenía
# git bisect va haciendo checkout a commits intermedios
git bisect good   # o `git bisect bad`, según corresponda, en cada paso
git bisect reset  # al terminar, vuelve a la rama original
```

Bisect automatizado con un script de test

```bash
git bisect start HEAD v1.4.0
git bisect run npm test -- --grep "checkout total calculation"
# bisect corre el test en cada commit intermedio y converge solo
```

Bisect con un script custom que valida una condición específica

```bash
#!/usr/bin/env bash
# returns 0 (good) or 1 (bad)
npm run build --silent && node scripts/check-output.js
```

```bash
git bisect run ./check.sh
```

#### Sources

- [Pro Git, Git Tools: Debugging with Git](https://git-scm.com/book/en/v2/Git-Tools-Debugging-with-Git)
- [Git, git-bisect Documentation](https://git-scm.com/docs/git-bisect)

### Recuperar trabajo perdido: reflog y limpieza de secretos con filter-repo

#### Details

Git casi nunca borra datos inmediatamente: cuando hacés `git reset --hard`, un rebase, o borrás una rama, los commits "perdidos" siguen existiendo en el object database hasta que el garbage collector los limpia (por defecto, tras 30-90 días de estar inalcanzables). El **reflog** (`git reflog`) es un log local de a dónde apuntó `HEAD` en cada operación, cada `checkout`, `commit`, `reset`, `rebase` deja una entrada. Si un reset o rebase salió mal, el reflog casi siempre tiene la entrada que apuntaba al estado anterior, y `git reset --hard <hash-del-reflog>` (o `git checkout` para inspeccionar primero) recupera ese estado.

Un caso distinto y más delicado es cuando un **secreto** (API key, contraseña) quedó commiteado y ya se empujó al remoto. Ahí no alcanza con borrarlo en un commit nuevo: el secreto sigue visible en el historial para cualquiera que clone el repo. La herramienta recomendada hoy por la documentación de Git es **`git filter-repo`**, no el viejo `git filter-branch`, este último está oficialmente desaconsejado por ser lento, tener foot-guns conocidos (por ejemplo, con submódulos y con ciertos merge commits) y porque `filter-repo` lo reemplaza con una herramienta más rápida, más segura y mejor mantenida.

El paso que la gente olvida: reescribir el historial local con `filter-repo` no arregla nada si el secreto expuesto sigue siendo válido, el historial viejo puede seguir viviendo en forks, en pulls locales de otros desarrolladores, o en el propio reflog del remoto. El primer paso real, siempre, es **rotar/revocar el secreto** en el sistema que lo emitió; reescribir el historial es limpieza posterior, no la mitigación principal.

#### Examples

Recuperar commits "perdidos" tras un reset --hard accidental

```bash
git reflog
# a1b2c3d HEAD@{0}: reset: moving to HEAD~3
# e4f5g6h HEAD@{1}: commit: feat: agregar validación  <- esto es lo que queremos recuperar
git reset --hard e4f5g6h
```

Recuperar una rama borrada por error

```bash
git reflog | grep "checkout: moving from feature/old"
git branch feature/old <hash-encontrado>
```

Quitar un archivo con un secreto de TODO el historial con filter-repo (no filter-branch)

```bash
# 1. Primero: rotar/revocar el secreto expuesto en el sistema origen
# 2. Instalar git-filter-repo (no viene con git por defecto)
pip install git-filter-repo

# 3. Eliminar el archivo de toda la historia
git filter-repo --path config/secrets.yml --invert-paths

# 4. Forzar el push del historial reescrito (coordinar con el equipo)
git push origin --force --all
```

#### Sources

- [Pro Git, Git Internals: Maintenance and Data Recovery](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery)
- [Git, git-reflog Documentation](https://git-scm.com/docs/git-reflog)
- [GitHub Docs, Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

## Interview Questions

### Un compañero pide ayuda: hizo `git rebase -i` para limpiar commits, algo salió mal, y ahora `git log` no muestra sus últimos 5 commits. ¿Cómo lo recuperás?

Le pediría correr `git reflog`, que muestra el historial local de a dónde apuntó `HEAD` en cada operación, incluyendo el estado justo antes del rebase fallido. Ahí buscaría la entrada anterior al `rebase` problemático (suele decir algo como `HEAD@{n}: rebase (start): checkout ...`) y usaría `git reset --hard <hash de esa entrada>` para volver a ese punto. Es importante entender que Git no borra objetos inmediatamente: mientras el garbage collector no haya corrido (por defecto, commits inalcanzables sobreviven 30-90 días), el trabajo casi siempre es recuperable vía reflog.

### ¿Por qué la regla es "nunca rebasees una rama que ya pusheaste y que otros pueden estar usando"?

Porque rebase reescribe commits generando hashes nuevos para cada uno, aunque el contenido sea "el mismo" cambio. Si alguien más ya bajó esa rama y agregó commits propios encima de los commits originales, tras tu rebase y push --force esa persona tiene una rama cuyo historial base ya no existe en el remoto, sus commits quedan huérfanos respecto al nuevo historial, y reconciliarlo requiere pasos de recuperación manuales (rebasear su rama contra la nueva base, con conflictos). Con merge esto no pasa porque nunca se reescriben commits existentes, solo se agregan nuevos.

### Se encuentra una API key commiteada hace 3 meses y ya pusheada varias veces. ¿Cuáles son los pasos, en orden, para resolverlo correctamente?

El primer paso, antes que nada, es rotar o revocar esa credencial en el sistema que la emitió, mientras la key siga siendo válida, el historial de git es un problema secundario. Recién después usaría `git filter-repo` (no el deprecado `filter-branch`) para eliminar el archivo o el valor de todo el historial del repositorio, y haría un push forzado del historial reescrito. Finalmente coordinaría con el equipo, porque todos los clones existentes van a tener el historial viejo (con la key expuesta) hasta que vuelvan a clonear o hagan un fetch + reset duro contra el nuevo historial.

### Un bug apareció en producción pero no saben en qué commit se introdujo, y hay más de 200 commits desde el último release estable. ¿Cómo lo encontrarías eficientemente?

Usaría `git bisect`, marcando el commit actual como `bad` y el último release conocido sin el bug como `good`. Si existe un test automatizado que reproduce el bug, usaría `git bisect run <comando de test>` para que bisect haga el checkout, corra el test e interprete el resultado en cada paso automáticamente, convergiendo al commit exacto sin intervención manual. Con 200 commits, la búsqueda binaria reduce el problema a unos 8 pasos (log₂ 200) en vez de revisar linealmente, y una vez identificado el commit, reviso su diff para entender la causa raíz real.

### Tenés que abrir un PR pero tu rama tiene 15 commits de trabajo con mensajes como "wip", "fix", "otro intento". ¿Cómo lo limpiás antes de pedir review?

Haría `git rebase -i` contra el commit base de la rama (por ejemplo `git rebase -i main`), y en la lista de commits usaría `squash` o `fixup` para fusionar los commits de iteración dentro de los commits lógicos que representan, dejando idealmente entre 1 y 3 commits bien mensajeados que un reviewer pueda entender de un vistazo. Esto es seguro porque la rama todavía no fue pusheada a un lugar donde otros dependan de ella, si ya la había pusheado, avisaría al equipo antes de forzar el push tras el rebase.

### ¿Cuál es la diferencia práctica entre usar merge y usar rebase al integrar una rama de feature terminada a main, y cuándo elegirías cada uno?

Merge crea un commit con dos padres que preserva exactamente la cronología real: se ve cuándo la rama de feature divergió y cuándo se reintegró, lo cual es valioso para auditoría e historial de releases. Rebase produce un historial lineal más limpio de leer pero pierde esa cronología real, porque los commits de la rama de feature se reescriben como si hubieran ocurrido después de todo lo que ya está en main. En la práctica, elegiría merge para integrar ramas de feature ya compartidas o de larga vida donde la trazabilidad importa, y rebase (seguido de un merge fast-forward) cuando quiero mantener un historial lineal en main y la rama de feature es de corta vida y no fue compartida con nadie más.
