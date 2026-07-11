---
stack: php
id: php-security
title: Seguridad en PHP
area: Seguridad
priority: high
resourceLabel: PHP Manual, Security
resourceUrl: https://www.php.net/manual/en/security.php
---

## Summary
Las vulnerabilidades que un entrevistador de backend PHP realmente pregunta: SQL injection, hashing de contraseñas, XSS y seguridad de sesión, con la API concreta del lenguaje para prevenirlas.

## Concepts

### SQL injection y prepared statements
#### Details
SQL injection ocurre cuando input del usuario se concatena directamente en una query en vez de tratarse como dato. El manual de PDO es explícito: los prepared statements separan la estructura de la query (fija, definida por el desarrollador) de los valores (variables, provistos por el usuario), así que el driver de base de datos nunca interpreta el input como parte del SQL, sin importar qué caracteres contenga.

La API de PDO (`prepare()` + `execute()` con parámetros posicionales `?` o nombrados `:nombre`) es la forma estándar recomendada; la alternativa legacy `mysqli` también soporta prepared statements con `bind_param`. Escapar manualmente con `addslashes()` o similar NO es una defensa confiable, hay vectores de bypass según encoding y no cubre todos los contextos (LIKE, ORDER BY con nombre de columna dinámico).

Para ORDER BY o nombres de columna dinámicos, que los prepared statements no pueden parametrizar (no son "valores", son parte de la estructura SQL), la defensa es una whitelist explícita de columnas permitidas, nunca interpolar el input directamente aunque esté "validado".

#### Examples
Vulnerable: concatenación directa
```php
// NUNCA hacer esto
$id = $_GET['id'];
$result = $pdo->query("SELECT * FROM users WHERE id = $id");
// input: "1 OR 1=1" filtra toda la tabla
```

Seguro: prepared statement con parámetros nombrados
```php
$stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id');
$stmt->execute(['id' => $_GET['id']]);
$user = $stmt->fetch();
```

Whitelist para ORDER BY dinámico (no parametrizable)
```php
$allowedColumns = ['name', 'created_at', 'email'];
$sort = in_array($_GET['sort'] ?? '', $allowedColumns, true) ? $_GET['sort'] : 'created_at';
$stmt = $pdo->query("SELECT * FROM users ORDER BY $sort"); // seguro: $sort viene de whitelist, no de input crudo
```

#### Sources
- [PHP Manual, PDO Prepared Statements](https://www.php.net/manual/en/pdo.prepared-statements.php)
- [PHP Manual, SQL Injection](https://www.php.net/manual/en/security.database.sql-injection.php)

### Hashing de contraseñas
#### Details
El manual de PHP es tajante: nunca usar `md5()` o `sha1()` para contraseñas, son funciones de hash rápidas diseñadas para integridad de datos, no para passwords, lo que las hace vulnerables a fuerza bruta con hardware moderno (GPUs calculan miles de millones por segundo). La API correcta es `password_hash()`, que por defecto usa bcrypt (o Argon2id si se especifica) y genera automáticamente un salt único por password, incluido en el hash resultante.

`password_hash()` es deliberadamente lento (configurable con el parámetro `cost`), lo que hace inviable la fuerza bruta a escala. `password_verify()` compara el password en texto plano contra el hash de forma segura (tiempo constante, previene timing attacks). No hace falta guardar el salt por separado: ya está codificado dentro del string que devuelve `password_hash()`.

Un detalle que distingue a un candidato senior: `password_needs_rehash()` permite migrar hashes antiguos a un algoritmo/costo más fuerte de forma transparente, verificando en cada login si el hash guardado usa los parámetros actuales y re-hasheando si no.

#### Examples
Hashear y verificar contraseñas correctamente
```php
$hash = password_hash($plainPassword, PASSWORD_BCRYPT, ['cost' => 12]);
// guardar $hash en la base, el salt ya está incluido

if (password_verify($inputPassword, $hash)) {
    // login exitoso
}
```

Rehash transparente al subir el costo del algoritmo
```php
if (password_verify($inputPassword, $storedHash)) {
    if (password_needs_rehash($storedHash, PASSWORD_BCRYPT, ['cost' => 12])) {
        $newHash = password_hash($inputPassword, PASSWORD_BCRYPT, ['cost' => 12]);
        // actualizar $newHash en la base
    }
}
```

#### Sources
- [PHP Manual, password_hash](https://www.php.net/manual/en/function.password-hash.php)
- [PHP Manual, password_verify](https://www.php.net/manual/en/function.password-verify.php)

### XSS y escaping de salida
#### Details
Cross-Site Scripting ocurre cuando input del usuario se imprime en HTML sin escapar y el navegador lo interpreta como marcado o script. El manual de PHP recomienda `htmlspecialchars()` para convertir caracteres especiales (`<`, `>`, `&`, `"`, `'`) en sus entidades HTML antes de imprimir cualquier dato que venga del usuario o de una fuente no confiable.

La regla práctica es escapar en el punto de salida (justo antes de imprimir), no en el punto de entrada, escapar al guardar en la base de datos corrompe los datos originales y falla si ese mismo dato se usa en un contexto no-HTML (una API JSON, un log). El flag `ENT_QUOTES` es importante: sin él, comillas simples no se escapan, dejando abierta una inyección dentro de atributos HTML delimitados con comillas simples.

Frameworks modernos (Laravel Blade con `{{ }}`, Twig) escapan por defecto automáticamente, pero en PHP puro o al usar `{!! !!}`/`|raw` para saltarse ese escape (por ejemplo para renderizar HTML de un editor WYSIWYG), la responsabilidad de sanitizar vuelve a caer en el desarrollador.

#### Examples
Vulnerable: imprimir input directo
```php
echo "Bienvenido, " . $_GET['name']; // input: <script>alert(1)</script>
```

Seguro: escapar en el punto de salida
```php
echo "Bienvenido, " . htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8');
```

Atributo HTML sin ENT_QUOTES queda vulnerable
```php
// Sin ENT_QUOTES, una comilla simple en $value rompe el atributo
echo '<input value=\'' . htmlspecialchars($value, ENT_QUOTES) . '\'>';
```

#### Sources
- [PHP Manual, htmlspecialchars](https://www.php.net/manual/en/function.htmlspecialchars.php)
- [PHP Manual, XSS](https://www.php.net/manual/en/security.xss.php)

### Seguridad de sesión y CSRF
#### Details
El manual de sesiones recomienda `session_regenerate_id(true)` inmediatamente después de un login exitoso o cualquier cambio de nivel de privilegio, para invalidar el ID de sesión anterior, esto previene session fixation, donde un atacante fuerza un ID de sesión conocido en la víctima antes de que se autentique. Los cookie flags también importan: `httponly` evita que JavaScript lea la cookie de sesión (mitiga robo vía XSS), `secure` evita enviarla por HTTP sin cifrar, y `samesite=Strict/Lax` mitiga CSRF al no enviar la cookie en requests cross-site.

CSRF (Cross-Site Request Forgery) explota que el navegador envía cookies automáticamente incluso en requests iniciados por un sitio malicioso. La defensa estándar es un token CSRF: un valor aleatorio impredecible generado por sesión, incluido como campo oculto en cada formulario, que el servidor valida contra el guardado en sesión antes de procesar la acción, un atacante externo no puede conocer ese token para falsificarlo.

Frameworks como Laravel generan y validan este token automáticamente (`@csrf`, middleware `VerifyCsrfToken`); en PHP puro hay que implementarlo a mano, y es exactamente el tipo de mecanismo que un entrevistador pide diseñar desde cero para verificar que entendés el problema, no solo el nombre.

#### Examples
Regenerar el ID de sesión al loguear
```php
session_start();
// ... validar credenciales ...
session_regenerate_id(true); // invalida el ID viejo, previene session fixation
$_SESSION['user_id'] = $user->id;
```

Cookie de sesión con flags seguros
```php
session_set_cookie_params([
    'httponly' => true,
    'secure' => true,
    'samesite' => 'Lax',
]);
session_start();
```

Token CSRF manual (sin framework)
```php
// al generar el formulario
$_SESSION['csrf_token'] ??= bin2hex(random_bytes(32));
echo '<input type="hidden" name="csrf_token" value="' . $_SESSION['csrf_token'] . '">';

// al procesar el POST
if (!hash_equals($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'] ?? '')) {
    http_response_code(403);
    exit('CSRF token inválido');
}
```

#### Sources
- [PHP Manual, Session Security](https://www.php.net/manual/en/session.security.php)
- [PHP Manual, session_regenerate_id](https://www.php.net/manual/en/function.session-regenerate-id.php)

## Interview Questions

### ¿Cómo prevenís SQL injection en PHP puro, sin un framework de por medio?
Con prepared statements de PDO: la query con placeholders se prepara una vez y los valores se bindean por separado, así el driver nunca interpreta el input del usuario como parte del SQL. Para casos que los prepared statements no cubren, como una columna de ORDER BY dinámica, uso una whitelist explícita de valores permitidos en vez de interpolar el input directamente.

### ¿Por qué `md5()` o `sha1()` nunca deberían usarse para guardar contraseñas?
Porque son funciones de hash diseñadas para ser rápidas (integridad de datos), lo que las hace vulnerables a fuerza bruta con hardware moderno. `password_hash()` usa bcrypt/Argon2, es deliberadamente lento y configurable, y genera un salt único por password automáticamente, lo que hace inviable atacar todos los hashes de una tabla filtrada de una sola vez con una rainbow table.

### Diseño: ¿cómo protegerías un formulario contra CSRF sin usar un framework?
Genero un token aleatorio impredecible por sesión con `random_bytes()`, lo incluyo como campo oculto en el formulario, y al procesar el POST comparo el token recibido contra el guardado en sesión con `hash_equals()` (comparación en tiempo constante, no `==`). Si no coinciden, rechazo el request, un atacante externo que induce el POST desde otro sitio no puede conocer ese token.

### ¿Qué configuración de cookies de sesión es crítica en producción y por qué?
`httponly` para que JavaScript no pueda leer la cookie (mitiga robo de sesión vía XSS), `secure` para que solo viaje por HTTPS, y `samesite=Lax` o `Strict` para que el navegador no la envíe en requests iniciados desde otro sitio, lo cual es una capa adicional contra CSRF más allá del token.

### ¿Por qué escaparías la salida con `htmlspecialchars()` en vez de sanear el input al guardarlo?
Porque el mismo dato guardado puede usarse en contextos distintos (HTML, una respuesta JSON de API, un log), y escapar en el punto de entrada corrompería el dato original para esos otros usos. Escapar justo antes de imprimir HTML garantiza que el escape sea correcto para ESE contexto específico, sin destruir el dato fuente.
