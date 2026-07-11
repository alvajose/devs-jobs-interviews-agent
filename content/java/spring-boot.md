---
stack: java
id: java-spring-boot
title: "Spring Boot: IoC, REST y persistencia"
area: Backend
priority: high
resourceLabel: Spring Boot, Reference Documentation
resourceUrl: https://docs.spring.io/spring-boot/docs/current/reference/html/
---

## Summary
Los cinco ejes de Spring Boot que aparecen en toda entrevista de backend Java: cómo funciona el contenedor IoC y por qué importa el scope de los beans, qué hace realmente la auto-configuración y cómo sobreescribirla, el modelo de Spring MVC para APIs REST con manejo centralizado de errores, el problema N+1 en Spring Data JPA con sus soluciones concretas, y el modelo de seguridad con filtros y JWT.

## Concepts

### IoC container y dependency injection: scopes y anotaciones clave
#### Details
**Inversion of Control (IoC)** significa que el framework administra el ciclo de vida de los objetos en lugar del código de la aplicación. El **ApplicationContext** de Spring es el contenedor IoC: escanea el classpath buscando beans, los instancia, los configura y los conecta entre sí (wiring). La "inversión" es que vos declarás dependencias y Spring las resuelve, no creás los objetos con `new`.

Las anotaciones estereotipo (`@Component`, `@Service`, `@Repository`, `@Controller`) son semánticamente equivalentes para el scanner, todas registran un bean. La diferencia es semántica/convencional y, en el caso de `@Repository`, funcional: Spring envuelve las excepciones de persistencia con `DataAccessException` automáticamente. `@Bean` se usa en clases `@Configuration` para registrar beans que requieren lógica de construcción explícita, como configurar un `DataSource` o un cliente HTTP.

El **scope** define cuántas instancias crea Spring. `singleton` (por defecto) crea una instancia por `ApplicationContext`, todos los que dependen de ese bean comparten la misma instancia. `prototype` crea una instancia nueva cada vez que se inyecta. Otros scopes como `request` y `session` son específicos de aplicaciones web. El bug común: inyectar un bean `prototype` en un bean `singleton`, el singleton solo recibe una instancia del prototype en su construcción, nunca se crea una nueva.

#### Examples
Beans con estereotipos y constructor injection
```java
@Service
public class OrderService {
    private final OrderRepository repository;
    private final PaymentGateway paymentGateway;

    // Constructor injection: recomendado sobre @Autowired en campo
    // Spring lo detecta automáticamente si hay un solo constructor
    public OrderService(OrderRepository repository, PaymentGateway paymentGateway) {
        this.repository = repository;
        this.paymentGateway = paymentGateway;
    }

    public Order placeOrder(OrderRequest request) {
        Order order = new Order(request);
        paymentGateway.charge(order);
        return repository.save(order);
    }
}
```

@Bean con lógica de construcción explícita
```java
@Configuration
public class AppConfig {

    @Bean
    @Scope("prototype")  // nueva instancia cada vez que se inyecta
    public HttpClient httpClient() {
        return HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }
}
```

#### Sources
- [Spring Framework, IoC Container](https://docs.spring.io/spring-framework/reference/core/beans.html)
- [Spring Framework, Bean Scopes](https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html)

---

### Spring Boot auto-configuración: cómo funciona y cómo sobreescribirla
#### Details
La auto-configuración es el mecanismo que permite que una aplicación Spring Boot funcione con configuración mínima. Al iniciarse, Spring Boot escanea los JARs del classpath buscando archivos `spring.factories` (hasta Spring Boot 2) o `AutoConfiguration.imports` (Spring Boot 3+). Esos archivos listan clases anotadas con `@AutoConfiguration` que configuran beans condicionalmente.

Las **anotaciones `@ConditionalOn*`** son el corazón del mecanismo:
- `@ConditionalOnClass(DataSource.class)`: solo configura el bean si `DataSource` está en el classpath.
- `@ConditionalOnMissingBean(DataSource.class)`: solo configura el bean si el usuario NO definió uno propio.
- `@ConditionalOnProperty("spring.cache.type")`: solo activa si la propiedad está definida.

La regla de oro: **la auto-configuración siempre cede ante tu configuración**. Si definís un `@Bean` del mismo tipo que uno auto-configurado, Spring usa el tuyo. Para override parcial, usás `application.properties`/`application.yml` para cambiar propiedades de configuración. Para deshabilitar una auto-configuración específica: `@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)`.

#### Examples
Cómo funciona una AutoConfiguration típica
```java
// Esto es una simplificación de cómo Spring Boot configura JdbcTemplate internamente
@AutoConfiguration
@ConditionalOnClass(JdbcTemplate.class)        // solo si JDBC está en classpath
@ConditionalOnSingleCandidate(DataSource.class)
public class JdbcTemplateAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean                   // solo si el usuario NO definió uno
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }
}
```

Sobreescribir la configuración de un bean auto-configurado
```java
@Configuration
public class CustomDataSourceConfig {

    // Este bean toma precedencia sobre el auto-configurado
    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://localhost/mydb");
        config.setMaximumPoolSize(20);           // override del default de HikariCP
        config.setConnectionTimeout(5000);
        return new HikariDataSource(config);
    }
}
```

#### Sources
- [Spring Boot, Auto-configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/using.html#using.auto-configuration)
- [Spring Boot, Creating Your Own Auto-configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.developing-auto-configuration)

---

### APIs REST con Spring MVC: controladores, binding y manejo de errores
#### Details
`@RestController` es una composición de `@Controller` + `@ResponseBody`: todos los métodos del controlador serializar el valor de retorno directamente al response body (por defecto como JSON vía Jackson). `@RequestMapping` (o sus variantes `@GetMapping`, `@PostMapping`, etc.) mapea URLs a métodos del controlador.

El **binding de parámetros** tiene tres casos principales: `@PathVariable` extrae valores del path de la URL (`/users/{id}`), `@RequestParam` extrae query parameters (`/users?active=true`), y `@RequestBody` deserializa el cuerpo JSON de la request a un objeto Java. Para requests que modifican estado (`POST`, `PUT`, `PATCH`), el cuerpo es la forma correcta de pasar datos; no los query params.

El manejo centralizado de errores con `@ControllerAdvice` + `@ExceptionHandler` es el patrón que distingue a un candidato senior. En lugar de envolver cada método del controlador en try-catch, definís una clase separada que intercepta excepciones específicas y retorna respuestas HTTP apropiadas. Esto mantiene los controladores limpios y centraliza la política de errores.

#### Examples
Controlador REST con binding completo
```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
        return userService.findById(id)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new UserNotFoundException(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createUser(@RequestBody @Valid CreateUserRequest request) {
        return userService.create(request);
    }
}
```

@ControllerAdvice para manejo centralizado de errores
```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFound(UserNotFoundException ex) {
        ErrorResponse error = new ErrorResponse("USER_NOT_FOUND", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(
            MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("VALIDATION_ERROR", message));
    }
}
```

#### Sources
- [Spring Framework, Web MVC](https://docs.spring.io/spring-framework/reference/web/webmvc.html)
- [Spring Framework, Annotated Controllers](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller.html)
- [Spring Framework, @ControllerAdvice](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-advice.html)

---

### Spring Data JPA: repositorios, JPQL y el problema N+1
#### Details
Spring Data JPA genera implementaciones de repositorios en tiempo de compilación a partir de interfaces que extienden `JpaRepository<T, ID>`. Con solo declarar métodos con nombres como `findByEmailAndActive(String email, boolean active)`, Spring deriva la query automáticamente. Para queries más complejas, usás `@Query` con JPQL (Java Persistence Query Language, orientado a entidades, no tablas) o SQL nativo con `nativeQuery = true`.

**JPQL vs Criteria API**: JPQL es String-based, conciso pero sin verificación de tipos en tiempo de compilación. La Criteria API es type-safe y composable programáticamente, útil cuando la query se construye dinámicamente. Para la mayoría de los casos, JPQL es suficiente; Criteria API brilla cuando tenés filtros opcionales que se combinan según parámetros recibidos.

El **problema N+1** es el error de rendimiento más común con JPA. Ocurre cuando cargás una colección de entidades y luego accedés a una asociación lazy de cada una, JPA ejecuta 1 query para la colección y N queries adicionales (una por entidad) para la asociación. Con 1000 órdenes, eso es 1001 queries. Las soluciones son: `JOIN FETCH` en JPQL para cargar la asociación junto con la entidad principal en una sola query, o `@EntityGraph` para declarar el eager loading de asociaciones específicas sin cambiar el tipo de fetch en la entidad.

#### Examples
Repositorio con derived query y @Query
```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Derived query, Spring genera la JPQL automáticamente
    List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);

    // JPQL explícita, JOIN FETCH para resolver N+1
    @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.customerId = :customerId")
    List<Order> findWithItemsByCustomerId(@Param("customerId") Long customerId);
}
```

@EntityGraph como alternativa al JOIN FETCH
```java
public interface ProductRepository extends JpaRepository<Product, Long> {

    // @EntityGraph permite cargar asociaciones específicas sin modificar la entidad
    @EntityGraph(attributePaths = {"category", "images"})
    List<Product> findByActiveTrue();
}
```

El problema N+1 en código
```java
// MAL: 1 query para órdenes + N queries para items de cada orden
List<Order> orders = orderRepository.findAll(); // 1 query
orders.forEach(o -> System.out.println(o.getItems().size())); // N queries, N+1!

// BIEN: 1 sola query con JOIN FETCH
List<Order> orders = orderRepository.findWithItemsByCustomerId(customerId); // 1 query
orders.forEach(o -> System.out.println(o.getItems().size())); // sin queries adicionales
```

#### Sources
- [Spring Data JPA, Reference Documentation](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/)
- [Spring Data JPA, Query Methods](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/#jpa.query-methods)
- [Spring Data JPA, EntityGraph](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/#jpa.entity-graph)

---

### Spring Security: filter chain, autenticación vs autorización y JWT
#### Details
Spring Security opera como una cadena de filtros Servlet (`SecurityFilterChain`) que intercepta todas las requests antes de que lleguen al controlador. Cada filtro tiene una responsabilidad específica: extraer credenciales, validar tokens, establecer el `SecurityContext`, verificar permisos. El orden importa, no podés validar autorización antes de establecer quién es el usuario.

**Autenticación vs autorización** es la primera pregunta conceptual en toda entrevista de Spring Security. Autenticación verifica la identidad ("¿sos quien decís ser?"), valida credenciales y establece un `Authentication` en el `SecurityContext`. Autorización verifica permisos ("¿tenés permiso para hacer esto?"), `@PreAuthorize`, `hasRole()`, `hasAuthority()` operan sobre el `Authentication` ya establecido. Sin autenticación previa, la autorización no tiene sentido.

Para integrar **JWT** en Spring Boot: el patrón estándar es un filtro personalizado que extiende `OncePerRequestFilter`. El filtro extrae el token del header `Authorization: Bearer <token>`, lo valida (firma, expiración), extrae el `username` y los roles, construye un `UsernamePasswordAuthenticationToken` y lo establece en el `SecurityContextHolder`. A partir de ahí, el resto del filter chain y los controladores pueden acceder a la identidad del usuario. No hay estado en el servidor, el token contiene toda la información necesaria.

#### Examples
Configuración de SecurityFilterChain con JWT
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())                          // JWT no necesita CSRF
            .sessionManagement(sm ->
                sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()       // login/register público
                .requestMatchers("/api/admin/**").hasRole("ADMIN") // solo admins
                .anyRequest().authenticated())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

Filtro JWT
```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        String username = jwtService.extractUsername(token);

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (jwtService.isTokenValid(token, userDetails)) {
                UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        chain.doFilter(request, response);
    }
}
```

#### Sources
- [Spring Security, Architecture](https://docs.spring.io/spring-security/reference/servlet/architecture.html)
- [Spring Security, Authentication](https://docs.spring.io/spring-security/reference/servlet/authentication/index.html)
- [Spring Security, Authorization](https://docs.spring.io/spring-security/reference/servlet/authorization/index.html)

## Interview Questions

### ¿Por qué se recomienda constructor injection sobre field injection con `@Autowired`?
Con field injection (`@Autowired` directo en el campo), el objeto solo puede construirse a través del contenedor IoC, no podés instanciarlo en tests sin reflection o un contexto de Spring completo. Con constructor injection, las dependencias son explícitas y obligatorias en la firma del constructor, lo que hace el objeto testeable con `new` directamente. Además, constructor injection permite declarar los campos como `final`, garantizando inmutabilidad y detectando en compilación si falta una dependencia. Spring detecta automáticamente el constructor si hay uno solo, sin necesidad de `@Autowired`.

### ¿Cómo funciona la auto-configuración de Spring Boot? ¿Cómo la sobreescribís?
Al arrancar, Spring Boot carga las clases listadas en `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`. Cada clase usa anotaciones `@ConditionalOn*` para activarse solo si ciertas condiciones se cumplen (clase en classpath, propiedad definida, bean ausente). La regla fundamental es que `@ConditionalOnMissingBean` hace que la auto-configuración ceda ante cualquier bean del mismo tipo que definas vos. Para sobreescribir, simplemente declarás un `@Bean` propio del mismo tipo en una clase `@Configuration`, Spring lo usará en lugar del auto-configurado.

### ¿Cuál es la diferencia entre `@Controller` y `@RestController`?
`@RestController` es equivalente a `@Controller` + `@ResponseBody` aplicado a todos los métodos. `@Controller` solo registra la clase como controlador Spring MVC; sin `@ResponseBody`, los métodos retornan nombres de vistas (para plantillas Thymeleaf/FreeMarker) en lugar de serializar el objeto al response body. `@RestController` asume que todos los métodos retornan datos, el objeto se serializa automáticamente a JSON (o XML) según el `Content-Type` negociado. Para construir APIs REST puras, siempre usás `@RestController`.

### ¿Qué es el problema N+1 y cómo lo resolvés con Spring Data JPA?
El problema N+1 ocurre cuando JPA ejecuta 1 query para cargar una colección de entidades y luego N queries adicionales para resolver una asociación lazy de cada entidad. Si cargás 500 órdenes y accedés a `order.getItems()` en un loop, ejecutás 501 queries en lugar de 1. La solución es usar `JOIN FETCH` en JPQL (`SELECT o FROM Order o JOIN FETCH o.items`) o `@EntityGraph(attributePaths = {"items"})` en el método del repositorio. Ambos aproximan una sola query SQL con JOIN que trae todos los datos necesarios. La diferencia es que `@EntityGraph` es más declarativo y no requiere escribir JPQL explícito.

### ¿Cuál es la diferencia entre autenticación y autorización en Spring Security?
Autenticación responde "¿quién sos?", verifica que las credenciales (password, token) sean válidas y establece el usuario en el `SecurityContext`. Autorización responde "¿qué podés hacer?", verifica que el usuario autenticado tenga los permisos necesarios para acceder a un recurso. Spring Security los separa en el filter chain: primero un filtro de autenticación extrae y valida las credenciales, y más adelante otro filtro de autorización verifica los roles o authorities del usuario ya identificado. Sin autenticación previa, la autorización no tiene contexto sobre quién hace la request.

### ¿Cómo funciona el singleton scope de Spring? ¿Cuál es el riesgo con estado mutable?
El scope singleton de Spring crea una sola instancia del bean por `ApplicationContext`, todos los componentes que inyectan ese bean comparten la misma instancia. El riesgo: si el bean tiene campos mutables (estado), múltiples requests concurrentes pueden leer y escribir esos campos simultáneamente causando condiciones de carrera. El patrón correcto es diseñar los beans singleton como stateless: toda la información de cada operación pasa por parámetros del método, no se almacena en campos del bean. Para beans con estado genuinamente necesario, el scope `prototype` crea una instancia nueva por inyección.
