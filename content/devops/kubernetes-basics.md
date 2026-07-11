---
stack: devops
id: devops-kubernetes-basics
title: "Kubernetes: objetos base, configuración y salud de los pods"
area: Infraestructura
priority: medium
resourceLabel: Kubernetes Docs, Concepts
resourceUrl: https://kubernetes.io/docs/concepts/
---

## Summary
Los objetos que realmente usás día a día en Kubernetes (Pod, Deployment, Service), cómo externalizar configuración con ConfigMaps y Secrets, y cómo diseñar probes de salud sin tirar abajo un servicio sano.

## Concepts

### Pod, Deployment y Service: quién gestiona qué
#### Details
Un **Pod** es la unidad más chica que Kubernetes programa: uno o más contenedores que comparten red (misma IP) y almacenamiento, pensados para correr siempre juntos. En la práctica casi nunca creás un Pod directamente, porque un Pod suelto no se auto-repara: si el nodo donde corre muere o el proceso crashea de forma irrecuperable, nadie lo vuelve a crear.

Por eso se usa un **Deployment**: describe declarativamente cuántas réplicas de un Pod querés corriendo y qué imagen usar, y un controlador en el control plane se encarga de reconciliar continuamente el estado real contra ese estado deseado, si un Pod muere, el Deployment crea uno nuevo; si actualizás la imagen, el Deployment orquesta un rolling update reemplazando Pods viejos por nuevos de forma gradual y controlada, con rollback disponible si algo sale mal.

El problema que queda sin resolver es que los Pods son efímeros y su IP cambia cada vez que se recrean. Un **Service** da una identidad de red estable (una IP virtual y un nombre DNS) que enruta tráfico hacia el conjunto de Pods que matchean un selector de labels, sin importar cuántas veces esos Pods se hayan reemplazado por debajo. La relación mental correcta: el Deployment gestiona el ciclo de vida de los Pods, el Service gestiona cómo se los descubre y se les enruta tráfico.

#### Examples
Deployment con 3 réplicas
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: myregistry/api:1.4.0
          ports:
            - containerPort: 8080
```

Service ClusterIP que enruta hacia esos Pods por label
```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
```

Ver cómo el Deployment reconcilia el estado tras borrar un Pod a mano
```bash
kubectl delete pod -l app=api --field-selector=status.phase=Running
kubectl get pods -l app=api -w   # aparece un Pod nuevo automáticamente
```

#### Sources
- [Kubernetes, Pods](https://kubernetes.io/docs/concepts/workloads/pods/)
- [Kubernetes, Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes, Service](https://kubernetes.io/docs/concepts/services-networking/service/)

### ConfigMaps y Secrets
#### Details
Hardcodear configuración dentro de la imagen de un contenedor obliga a rebuildear y redeployar por cada cambio de config, y hace que la misma imagen no sirva para distintos entornos (dev/staging/prod). Un **ConfigMap** externaliza esa configuración no sensible (URLs, feature flags, nombres de bucket) como pares clave-valor que se inyectan en el Pod como variables de entorno o como archivos montados, desacoplando la imagen del entorno en el que corre.

Un **Secret** tiene la misma mecánica de API que un ConfigMap, pero está pensado para datos sensibles: credenciales, tokens, certificados. El caveat que TODO entrevistador espera que sepas: por defecto los Secrets de Kubernetes solo están **codificados en base64**, no encriptados. Base64 es trivialmente reversible (`echo <valor> | base64 -d`), así que cualquiera con acceso de lectura a los Secrets vía la API o a los manifiestos versionados en git puede leerlos en texto plano. Kubernetes ofrece "encryption at rest" para el etcd subyacente, pero hay que habilitarla explícitamente; no es el comportamiento por defecto.

Por eso, en entornos serios, los Secrets nativos de Kubernetes casi nunca son la solución completa: se combinan con un vault externo (HashiCorp Vault, AWS Secrets Manager, Sealed Secrets, external-secrets-operator) que gestiona el cifrado real y la rotación, y que sincroniza esos valores hacia Secrets de Kubernetes en runtime. La respuesta de entrevista madura no es "uso Secrets porque son para eso", sino explicar que Secrets son la interfaz nativa pero no garantizan cifrado por sí solos.

#### Examples
ConfigMap con configuración no sensible
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  LOG_LEVEL: "info"
  FEATURE_NEW_CHECKOUT: "true"
```

Secret, noten que el valor solo está en base64, no cifrado
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=   # base64 de "password123", no encriptado
```

Consumir ambos como variables de entorno en un Pod
```yaml
spec:
  containers:
    - name: api
      image: myregistry/api:1.4.0
      envFrom:
        - configMapRef:
            name: api-config
        - secretRef:
            name: api-secrets
```

Verificar que un Secret es reversible con un simple decode
```bash
kubectl get secret api-secrets -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

#### Sources
- [Kubernetes, ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Kubernetes, Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Kubernetes, Encrypting Confidential Data at Rest](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/)

### Liveness vs. readiness probes
#### Details
Kubernetes necesita una forma de saber si un contenedor está "vivo" y si está "listo para recibir tráfico", y son preguntas distintas con acciones distintas. Un **liveness probe** responde "¿este proceso sigue funcionando o quedó en un estado roto del que no puede recuperarse solo?". Si el liveness probe falla repetidamente, el kubelet **mata y reinicia el contenedor**, es el mecanismo de auto-recuperación ante deadlocks o estados colgados.

Un **readiness probe** responde una pregunta distinta: "¿este contenedor está listo ahora mismo para recibir tráfico?". Si el readiness probe falla, el Pod NO se reinicia, simplemente se lo saca temporalmente del pool de endpoints del Service, así que deja de recibir tráfico nuevo hasta que vuelva a pasar el check. Esto es crítico durante el arranque de una app que necesita cargar cachés o conectarse a una base de datos: no está rota, solo no está lista todavía.

El error clásico que causa outages es usar el MISMO check para ambos probes, o peor, usar un liveness probe agresivo que dependa de servicios externos (como la conexión a una base de datos). Si la base de datos tiene una latencia momentánea, un liveness probe mal diseñado puede matar y reiniciar en loop TODOS los Pods de la app al mismo tiempo, convirtiendo un problema transitorio de la DB en un outage total del servicio, cuando lo correcto hubiera sido que el readiness probe sacara los Pods del balanceo sin reiniciarlos, dándole tiempo a la DB de recuperarse.

#### Examples
Liveness probe simple sobre un endpoint de salud del proceso
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3
```

Readiness probe que sí depende de dependencias externas (DB, cache)
```yaml
readinessProbe:
  httpGet:
    path: /readyz
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 2
```

Antipatrón: liveness probe acoplado a la base de datos (puede causar cascading restarts)
```yaml
# NO hacer esto: si la DB tiene latencia, k8s reinicia el contenedor en loop
livenessProbe:
  httpGet:
    path: /healthz-with-db-check   # revisa la DB, debería ser el readiness
    port: 8080
```

#### Sources
- [Kubernetes, Liveness, Readiness, and Startup Probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)
- [Kubernetes, Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

### Escalado: réplicas y HorizontalPodAutoscaler
#### Details
El campo `replicas` de un Deployment fija cuántos Pods idénticos deben correr en todo momento; escalarlo manualmente (`kubectl scale`) es el mecanismo más simple de escalado horizontal, pero requiere intervención humana o un script externo reaccionando a métricas. El **HorizontalPodAutoscaler (HPA)** automatiza esa decisión: observa una métrica (por defecto, uso de CPU promedio de los Pods, aunque puede configurarse con métricas custom vía el metrics API) y ajusta el número de réplicas dentro de un rango mínimo y máximo definido, para mantener esa métrica cerca de un valor objetivo.

La idea conceptual clave es que el HPA actúa sobre el mismo campo `replicas` que controlarías a mano, no reemplaza al Deployment, lo complementa cerrando el loop de control automáticamente. Es fundamental distinguirlo del escalado vertical (VerticalPodAutoscaler, que ajusta los requests/limits de CPU/memoria de un Pod existente) y del autoescalado de nodos del clúster (Cluster Autoscaler, que agrega o quita nodos del clúster cuando los Pods no entran en la capacidad actual). Los tres resuelven problemas distintos y suelen combinarse en producción.

En entrevista, un punto que separa a alguien con experiencia real es mencionar que el HPA necesita que los Pods tengan `resources.requests` definidos para poder calcular porcentajes de uso con sentido, sin requests configurados, el HPA basado en CPU simplemente no tiene una base contra la cual medir el porcentaje objetivo.

#### Examples
HorizontalPodAutoscaler basado en CPU
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

Requests/limits necesarios en el Deployment para que el HPA tenga base de cálculo
```yaml
resources:
  requests:
    cpu: "250m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```

Escalado manual imperativo, sin HPA
```bash
kubectl scale deployment api --replicas=5
kubectl get hpa api-hpa -w   # ver cómo el HPA reacciona a la carga
```

#### Sources
- [Kubernetes, Horizontal Pod Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Kubernetes, HorizontalPodAutoscaler Walkthrough](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)

## Interview Questions

### Un Pod queda en estado `CrashLoopBackOff`. ¿Qué pasos seguís para diagnosticarlo?
Primero miraría `kubectl describe pod <nombre>` para ver eventos recientes (OOMKilled, fallos de probe, errores de imagen) y el motivo del último reinicio. Después revisaría los logs del contenedor actual y, si ya se reinició, los logs del contenedor anterior con `kubectl logs <pod> --previous`, porque los logs del contenedor "vivo" pueden no mostrar el error que causó el crash previo. Si el problema es un liveness probe demasiado agresivo o mal configurado, ahí vería reinicios sin errores de aplicación reales en los logs, lo que apunta a un problema de configuración del probe y no del código.

### ¿Por qué en general no creás Pods directamente en producción, sino que usás un Deployment?
Un Pod suelto no se auto-repara: si el nodo falla o el contenedor crashea de forma irrecuperable, nadie lo vuelve a crear, y esa carga simplemente desaparece del clúster. Un Deployment mantiene un controlador que reconcilia continuamente el número de réplicas deseado contra el real, recreando Pods que mueren y orquestando rolling updates con la posibilidad de rollback. Es la diferencia entre gestionar el ciclo de vida a mano y delegarlo a un control loop declarativo, que es justamente el modelo mental central de Kubernetes.

### Te piden guardar la contraseña de una base de datos para que la use un Pod. ¿Usarías directamente un Secret de Kubernetes? ¿Qué le explicarías al equipo sobre sus límites?
Usaría un Secret como interfaz de consumo dentro del clúster, pero les aclararía que por defecto un Secret solo está codificado en base64, no encriptado, cualquiera con acceso de lectura a la API o al YAML versionado puede decodificarlo trivialmente. Para producción, combinaría eso con encryption at rest habilitado en etcd y, preferentemente, con un gestor externo de secretos (Vault, AWS Secrets Manager, o un operador tipo external-secrets) que maneje el cifrado real, la rotación y la auditoría, sincronizando esos valores hacia Secrets de Kubernetes en runtime en vez de versionarlos en git.

### Un servicio empieza a fallar intermitentemente cada vez que la base de datos tiene un pico de latencia, y en esos momentos TODOS los Pods se reinician en cascada. ¿Qué sospechás y cómo lo arreglarías?
Sospecho que el liveness probe está chequeando la conexión a la base de datos en vez de solo la salud del proceso. Cuando la DB tiene latencia, el probe falla, Kubernetes interpreta que el proceso está roto y reinicia TODOS los Pods a la vez, convirtiendo un problema transitorio externo en un outage total. La corrección es separar responsabilidades: el liveness probe debe verificar únicamente que el proceso responde (sin dependencias externas), y un readiness probe aparte debe verificar la conexión a la DB, así, ante latencia de la DB, los Pods simplemente salen del balanceo temporalmente sin reiniciarse, dándole tiempo a la dependencia de recuperarse.

### ¿Cómo decidís el rango de `minReplicas`/`maxReplicas` de un HorizontalPodAutoscaler y qué prerequisito de configuración suele faltar cuando el HPA "no hace nada"?
El mínimo lo fijo en base a la carga base esperada más un margen de tolerancia a fallos (nunca en 1, para no perder disponibilidad si un Pod se reinicia), y el máximo en base a la capacidad del clúster y el presupuesto. La causa más común de que un HPA "no reaccione" es que el Deployment no tiene `resources.requests` de CPU definido en los contenedores: sin ese valor, el HPA basado en CPU no tiene contra qué calcular el porcentaje de utilización objetivo, así que simplemente no puede tomar decisiones de escalado.

### ¿Qué gestiona exactamente un Service que un Deployment no resuelve por sí solo?
El Deployment garantiza que existan N réplicas sanas de un Pod, pero los Pods son efímeros y su IP cambia cada vez que se recrean. El Service da una identidad de red estable, una IP virtual y un nombre DNS interno, que enruta tráfico hacia el conjunto actual de Pods que matchean su selector de labels, sin que los clientes necesiten conocer ni actualizar IPs de Pods individuales. Sin un Service, cualquier cliente que quisiera hablarle a la app tendría que descubrir manualmente las IPs de los Pods vigentes en cada momento, lo cual es inviable en un sistema donde los Pods se reemplazan constantemente.
