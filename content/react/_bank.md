---
stack: react
kind: question-bank
source: sudheerj/reactjs-interview-questions
sourceUrl: https://github.com/sudheerj/reactjs-interview-questions
license: MIT
copyright: Copyright (c) 2017-Present Sudheer Jonna
---

<!-- Ingested verbatim from https://github.com/sudheerj/reactjs-interview-questions (MIT). Copyright (c) 2017-Present Sudheer Jonna.
     Re-run: node scripts/ingest/run.mjs react-sudheerj, do NOT hand-edit. -->

## Interview Questions

### When to use a Class Component over a Function Component?
After the addition of Hooks(i.e. React 16.8 onwards) it is always recommended to use Function components over Class components in React. Because you could use state, lifecycle methods and other features that were only available in class component present in function component too.

But even there are two reasons to use Class components over Function components.

1. If you need a React functionality whose Function component equivalent is not present yet, like Error Boundaries.
2. In older versions, If the component needs _state or lifecycle methods_ then you need to use class component.

So the summary to this question is as follows:

**Use Function Components:**

- If you don't need state or lifecycle methods, and your component is purely presentational.
- For simplicity, readability, and modern code practices, especially with the use of React Hooks for state and side effects.

**Use Class Components:**

- If you need to manage state or use lifecycle methods.
- In scenarios where backward compatibility or integration with older code is necessary.

**Note:** You can also use reusable [react error boundary](https://github.com/bvaughn/react-error-boundary) third-party component without writing any class. i.e, No need to use class components for Error boundaries.

The usage of Error boundaries from the above library is quite straight forward.

> **_Note when using react-error-boundary:_** ErrorBoundary is a client component. You can only pass props to it that are serializable or use it in files that have a `"use client";` directive.

```jsx
"use client";

import { ErrorBoundary } from "react-error-boundary";

<ErrorBoundary fallback={<div>Something went wrong</div>}>
  <ExampleApplication />
</ErrorBoundary>;
```

### What are Pure Components?
Pure components are the components which render the same output for the same state and props. In function components, you can achieve these pure components through memoized `React.memo()` API wrapping around the component. This API prevents unnecessary re-renders by comparing the previous props and new props using shallow comparison. So it will be helpful for performance optimizations.

But at the same time, it won't compare the previous state with the current state because function component itself prevents the unnecessary rendering by default when you set the same state again.

The syntactic representation of memoized components looks like below,

```jsx
const MemoizedComponent = memo(SomeComponent, arePropsEqual?);
```

Below is the example of how child component(i.e., EmployeeProfile) prevents re-renders for the same props passed by parent component(i.e.,EmployeeRegForm).

```jsx
import { memo, useState } from "react";

const EmployeeProfile = memo(function EmployeeProfile({ name, email }) {
  return (
    <>
      <p>Name:{name}</p>
      <p>Email: {email}</p>
    </>
  );
});
export default function EmployeeRegForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <>
      <label>
        Name:{" "}
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Email:{" "}
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <hr />
      <EmployeeProfile name={name} />
    </>
  );
}
```

In the above code, the email prop has not been passed to child component. So there won't be any re-renders for email prop change.

In class components, the components extending _`React.PureComponent`_ instead of _`React.Component`_ become the pure components. When props or state changes, _PureComponent_ will do a shallow comparison on both props and state by invoking `shouldComponentUpdate()` lifecycle method.

**Note:** `React.memo()` is a higher-order component.

### What is "key" prop and what is the benefit of using it in arrays of elements?
A `key` is a special attribute you **should** include when mapping over arrays to render data. _Key_ prop helps React identify which items have changed, are added, or are removed.

Keys should be unique among its siblings. Most often we use ID from our data as _key_:

```jsx harmony
const todoItems = todos.map((todo) => <li key={todo.id}>{todo.text}</li>);
```

When you don't have stable IDs for rendered items, you may use the item _index_ as a _key_ as a last resort:

```jsx harmony
const todoItems = todos.map((todo, index) => (
  <li key={index}>{todo.text}</li>
));
```
**Benefits of key:**
  *   Enables React to **efficiently update and re-render** components.
  *   Prevents unnecessary re-renders by **reusing** components when possible.
  *   Helps **maintain internal state** of list items correctly.

**Note:**

1. Using _indexes_ for _keys_ is **not recommended** if the order of items may change. This can negatively impact performance and may cause issues with component state.
2. If you extract list item as separate component then apply _keys_ on list component instead of `li` tag.
3. There will be a warning message in the console if the `key` prop is not present on list items.
4. The key attribute accepts either string or number and internally convert it as string type.
5. Don't generate the key on the fly something like `key={Math.random()}`. Because the keys will never match up between re-renders and DOM created everytime.

### What is Virtual DOM?
The _Virtual DOM_ (VDOM) is a lightweight, in-memory representation of _Real DOM_ used by libraries like React to optimize UI rendering. The representation of a UI is kept in memory and synced with the "real" DOM. It's a step that happens between the render function being called and the displaying of elements on the screen. This entire process is called _reconciliation_.

### What are controlled components?
A **controlled component** is a React component that **fully manages the form element's state**(e.g, elements like `<input>`, `<textarea>`, or `<select>`))  using React's internal state mechanism. i.e, The component does not manage its own internal state, instead, React acts as the single source of truth for form data.

The controlled components will be implemented using the below steps,

1. Initialize the state using `useState` hooks in function components or inside constructor for class components.
2. Set the value of the form element to the respective state variable.
3. Create an event handler(`onChange`) to handle the user input changes through `useState`'s updater function or `setState` from class component.
4. Attach the above event handler to form element's change or click events

**Note:** React re-renders the component every time the input value changes.

   For example, the name input field updates the username using `handleChange` event handler as below,

   ```javascript
   import React, { useState } from "react";

   function UserProfile() {
 const [username, setUsername] = useState("");

 const handleChange = (e) => {
   setUsername(e.target.value);
 };

 return (
   <form>
     <label>
       Name:
       <input type="text" value={username} onChange={handleChange} />
     </label>
   </form>
 );
   }
   ```
   In these components, DOM does not hold the actual data instead React does.
   
   **Benefits:**

   *   Easy to implement **validation**, **conditional formatting**, or **live feedback**.
   *   Full control over form data.
   *   Easier to test and debug because the data is centralized in the component’s state.

### What are uncontrolled components?
The **Uncontrolled components** are form elements (like `<input>`, `<textarea>`, or `<select>`) that **manage their own state internally** via the **DOM**, rather than through React state.
You can query the DOM using a `ref` to find its current value when you need it. This is a bit more like traditional HTML.

The uncontrolled components will be implemented using the below steps,

1. Create a ref using `useRef` react hook in function component or `React.createRef()` in class based component.
2. Attach this `ref` to the form element.
3. The form element value can be accessed directly through `ref` in event handlers or `componentDidMount` for class components

In the below UserProfile component, the `username` input is accessed using ref.

```jsx harmony
import React, { useRef } from "react";

function UserProfile() {
  const usernameRef = useRef(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log("The submitted username is: " + usernameRef.current.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Username:
        <input type="text" ref={usernameRef} />
      </label>
      <button type="submit">Submit</button>
    </form>
  );
}
```
**Note:** Here, DOM is in charge of the value. React only accesses the value when needed (via `ref`).

**Benefits:**
 *   **Less boilerplate**, no need for `useState` and `onChange`.
 *   Useful for **quick form setups** or when integrating with **non-React code**.
 *   Slightly better **performance** in very large forms (fewer re-renders).

In most cases, it's recommend to use controlled components to implement forms. In a controlled component, form data is handled by a React component. The alternative is uncontrolled components, where form data is handled by the DOM itself.

<details><summary><b>See Class</b></summary>
<p>

```jsx harmony
class UserProfile extends React.Component {
  constructor(props) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.input = React.createRef();
  }

  handleSubmit(event) {
    alert("A name was submitted: " + this.input.current.value);
    event.preventDefault();
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label>
          {"Name:"}
          <input type="text" ref={this.input} />
        </label>
        <input type="submit" value="Submit" />
      </form>
    );
  }
}
```

</p>
</details>

### What are Higher-Order Components?
A _higher-order component_ (_HOC_) is a function that takes a component and returns a new enhanced component with additional props, behavior, or data. It’s a design pattern based on React’s compositional nature, allowing you to reuse logic across multiple components without modifying their internals.

We consider HOCs **pure components** because they don’t mutate or copy behavior from the original component,they simply **wrap it**, enhance it, and pass through the necessary props. The wrapped component remains decoupled and reusable.

```javascript
const EnhancedComponent = higherOrderComponent(WrappedComponent);
```
Let's take an example of a `withAuth` higher-order component (HOC) in React. This HOC will check if a user is authenticated and either render the wrapped component if authenticated or redirect (or show a message) if not.

**withAuth HOC Example:**
```jsx
import React from 'react';
import { Navigate } from 'react-router-dom'; // For redirection (assuming React Router v6)

const isAuthenticated = () => {
  // e.g., check for a valid token in localStorage or context
  return !!localStorage.getItem('authToken');
};

function withAuth(WrappedComponent) {
  return function AuthenticatedComponent(props) {
    if (!isAuthenticated()) {
      // User is NOT authenticated, redirect to login page
      return <Navigate to="/login" replace />;
    }

    // User is authenticated, render the wrapped component
    return <WrappedComponent {...props} />;
  };
}

export default withAuth;
```
**Usage**
```jsx
import React from 'react';
import withAuth from './withAuth';

function Dashboard() {
  return <h1>Welcome to the Dashboard!</h1>;
}

// Wrap Dashboard with withAuth HOC
export default withAuth(Dashboard);
```

HOC can be used for many use cases:

1. Code reuse, logic and bootstrap abstraction (e.g., fetching data, permissions, theming).
2. Render hijacking (e.g., conditional rendering or layout changes).
3. State abstraction and manipulation(e.g., handling form logic).
4. Props manipulation(e.g., injecting additional props or filtering them).

Some of the real-world examples of HOCs in react eco-system:
1. connect() from react-redux
2. withRouter() from React Router v5
3. withTranslation() from react-i18next
4. withApollo() from Apollo client
5. withFormik from Formik library
6. withTheme from styled components

### What is reconciliation?
`Reconciliation` is the process through which React updates the Browser DOM and makes React work faster. React use a `diffing algorithm` so that component updates are predictable and faster. React would first calculate the difference between the `real DOM` and the copy of DOM `(Virtual DOM)` when there's an update of components.
React stores a copy of Browser DOM which is called `Virtual DOM`. When we make changes or add data, React creates a new Virtual DOM and compares it with the previous one. This comparison is done by `Diffing Algorithm`.
Now React compares the Virtual DOM with Real DOM. It finds out the changed nodes and updates only the changed nodes in Real DOM leaving the rest nodes as it is. This process is called _Reconciliation_.

### What are fragments?
It's a common pattern or practice in React for a component to return multiple elements. _Fragments_ let you group a list of children without adding extra nodes to the DOM.
You need to use either `<Fragment>` or a shorter syntax having empty tag (`<></>`).

Below is the example of how to use fragment inside _Story_ component.

```jsx harmony
function Story({ title, description, date }) {
  return (
    <Fragment>
      <h2>{title}</h2>
      <p>{description}</p>
      <p>{date}</p>
    </Fragment>
  );
}
```

It is also possible to render list of fragments inside a loop with the mandatory **key** attribute supplied.

```jsx harmony
function StoryBook() {
  return stories.map((story) => (
    <Fragment key={story.id}>
      <h2>{story.title}</h2>
      <p>{story.description}</p>
      <p>{story.date}</p>
    </Fragment>
  ));
}
```

Usually, you don't need to use `<Fragment>` until there is a need of _key_ attribute. The usage of shorter syntax looks like below.

```jsx harmony
function Story({ title, description, date }) {
  return (
    <>
      <h2>{title}</h2>
      <p>{description}</p>
      <p>{date}</p>
    </>
  );
}
```

### What are portals in React?
A Portal is a React feature that enables rendering children into a DOM node that exists outside the parent component's DOM hierarchy, while still preserving the React component hierarchy. Portals help avoid CSS stacking issues,for example, elements with position: fixed may not behave as expected inside a parent with transform. Portals solve this by rendering content (like modals or tooltips) outside such constrained DOM contexts.

```javascript
ReactDOM.createPortal(child, container);
```
*   `child`: Any valid React node (e.g., JSX, string, fragment).
*   `container`: A real DOM node (e.g., `document.getElementById('modal-root')`).

Even though the content renders elsewhere in the DOM, it still behaves like a normal child in React. It has access to context, state, and event handling.

**Example:- Modal:**
```jsx
function Modal({ children }) {
  return ReactDOM.createPortal(
    <div className="modal">{children}</div>,
    document.body)
  );
}
```
The above code will render the modal content into the body element in the HTML, not inside the component's usual location.

### What is the impact of indexes as keys?
Keys should be stable, predictable, and unique so that React can keep track of elements.

In the below code snippet each element's key will be based on ordering, rather than tied to the data that is being represented. This limits the optimizations that React can do and creates confusing bugs in the application.

```jsx harmony
{
  todos.map((todo, index) => <Todo {...todo} key={index} />);
}
```

If you use element data for unique key, assuming `todo.id` is unique to this list and stable, React would be able to reorder elements without needing to reevaluate them as much.

```jsx harmony
{
  todos.map((todo) => <Todo {...todo} key={todo.id} />);
}
```

**Note:** If you don't specify `key` prop at all, React will use index as a key's value while iterating over an array of data.

### How do you conditionally render components?
In some cases you want to render different components depending on some state. JSX does not render `false` or `undefined`, so you can use conditional _short-circuiting_ to render a given part of your component only if a certain condition is true.

```jsx harmony
const MyComponent = ({ name, address }) => (
  <div>
    <h2>{name}</h2>
    {address && <p>{address}</p>}
  </div>
);
```

If you need an `if-else` condition then use _ternary operator_.

```jsx harmony
const MyComponent = ({ name, address }) => (
  <div>
    <h2>{name}</h2>
    {address ? <p>{address}</p> : <p>{"Address is not available"}</p>}
  </div>
);
```

### How do you memoize a component?
There are memoize libraries available which can be used on function components.

For example `moize` library can memoize the component in another component.

```jsx harmony
import moize from "moize";
import Component from "./components/Component"; // this module exports a non-memoized component

const MemoizedFoo = moize.react(Component);

const Consumer = () => {
  <div>
    {"I will memoize the following entry:"}
    <MemoizedFoo />
  </div>;
};
```

**Update:** Since React v16.6.0, we have a `React.memo`. It provides a higher order component which memoizes component unless the props change. To use it, simply wrap the component using React.memo before you use it.

```js
const MemoComponent = React.memo(function MemoComponent(props) {
  /* render using props */
});
OR;
export default React.memo(MyFunctionComponent);
```

### How do you access props in attribute quotes?
React (or JSX) doesn't support variable interpolation inside an attribute value. The below representation won't work:

```jsx harmony
<img className="image" src="images/{this.props.image}" />
```

But you can put any JS expression inside curly braces as the entire attribute value. So the below expression works:

```jsx harmony
<img className="image" src={"images/" + this.props.image} />
```

Using _template strings_ will also work:

```jsx harmony
<img className="image" src={`images/${this.props.image}`} />
```

### Why can't you update props in React?
The React philosophy is that props should be _immutable_(read only) and _top-down_. This means that a parent can send any prop values to a child, but the child can't modify received props.

### How to reset state in Redux?
You need to write a _root reducer_ in your application which delegate handling the action to the reducer generated by `combineReducers()`.

 For example, let us take `rootReducer()` to return the initial state after `USER_LOGOUT` action. As we know, reducers are supposed to return the initial state when they are called with `undefined` as the first argument, no matter the action.

 ```javascript
 const appReducer = combineReducers({
   /* your app's top-level reducers */
 });

 const rootReducer = (state, action) => {
   if (action.type === "USER_LOGOUT") {
     state = undefined;
   }

   return appReducer(state, action);
 };
 ```

 In case of using `redux-persist`, you may also need to clean your storage. `redux-persist` keeps a copy of your state in a storage engine. First, you need to import the appropriate storage engine and then, to parse the state before setting it to undefined and clean each storage state key.

 ```javascript
 const appReducer = combineReducers({
   /* your app's top-level reducers */
 });

 const rootReducer = (state, action) => {
   if (action.type === "USER_LOGOUT") {
     Object.keys(state).forEach((key) => {
       storage.removeItem(`persist:${key}`);
     });

     state = undefined;
   }

   return appReducer(state, action);
 };
 ```

### What is the difference between React context and React Redux?
You can use **Context** in your application directly and is going to be great for passing down data to deeply nested components which what it was designed for.

 Whereas **Redux** is much more powerful and provides a large number of features that the Context API doesn't provide. Also, React Redux uses context internally but it doesn't expose this fact in the public API.

### Why are Redux state functions called reducers?
Reducers always return the accumulation of the state (based on all previous and current actions). Therefore, they act as a reducer of state. Each time a Redux reducer is called, the state and action are passed as parameters. This state is then reduced (or accumulated) based on the action, and then the next state is returned. You could _reduce_ a collection of actions and an initial state (of the store) on which to perform these actions to get the resulting final state.

### How to structure Redux top level directories?
Most of the applications has several top-level directories as below:

 1. **Components**: Used for _dumb_ components unaware of Redux.
 2. **Containers**: Used for _smart_ components connected to Redux.
 3. **Actions**: Used for all action creators, where file names correspond to part of the app.
 4. **Reducers**: Used for all reducers, where files name correspond to state key.
 5. **Store**: Used for store initialization.

 This structure works well for small and medium size apps.

### Why is DevTools not loading in Chrome for local files?
If you opened a local HTML file in your browser (`file://...`) then you must first open _Chrome Extensions_ and check `Allow access to file URLs`.

### What is React memo function?
Class components can be restricted from re-rendering when their input props are the same using **PureComponent or shouldComponentUpdate**. Now you can do the same with function components by wrapping them in **React.memo**.

 ```jsx
 const MyComponent = React.memo(function MyComponent(props) {
   /* only rerenders if props change */
 });
 ```

### What is React lazy function?
The `React.lazy` function lets you render a dynamic import as a regular component. It will automatically load the bundle containing the `OtherComponent` when the component gets rendered. This must return a Promise which resolves to a module with a default export containing a React component.

 ```jsx
 const OtherComponent = React.lazy(() => import("./OtherComponent"));

 function MyComponent() {
   return (
     <div>
       <OtherComponent />
     </div>
   );
 }
 ```

 **Note:**
 `React.lazy` and `Suspense` is not yet available for server-side rendering. If you want to do code-splitting in a server rendered app, we still recommend React Loadable.

### How to prevent unnecessary updates using setState?
You can compare the current value of the state with an existing state value and decide whether to rerender the page or not. If the values are the same then you need to return **null** to stop re-rendering otherwise return the latest state value.

 For example, the user profile information is conditionally rendered as follows,

 ```jsx
 getUserProfile = (user) => {
   const latestAddress = user.address;
   this.setState((state) => {
     if (state.address === latestAddress) {
       return null;
     } else {
       return { title: latestAddress };
     }
   });
 };
 ```

### How do you render Array, Strings and Numbers in React 16 Version?
**Arrays**: Unlike older releases, you don't need to make sure **render** method return a single element in React16. You are able to return multiple sibling elements without a wrapping element by returning an array.

 For example, let us take the below list of developers,

 ```jsx
 const ReactJSDevs = () => {
   return [
     <li key="1">John</li>,
     <li key="2">Jackie</li>,
     <li key="3">Jordan</li>,
   ];
 };
 ```

 You can also merge this array of items in another array component.

 ```jsx
 const JSDevs = () => {
   return (
     <ul>
       <li>Brad</li>
       <li>Brodge</li>
       <ReactJSDevs />
       <li>Brandon</li>
     </ul>
   );
 };
 ```

 **Strings and Numbers:** You can also return string and number type from the render method.

 ```jsx
 render() {
  return 'Welcome to ReactJS questions';
 }
 // Number
 render() {
  return 2018;
 }
 ```

### What are hooks?
Hooks is a special JavaScript function that allows you use state and other React features without writing a class. This pattern has been introduced as a new feature in React 16.8 and helped to isolate the stateful logic from the components.

 Let's see an example of useState hook:

 ```jsx
 import { useState } from "react";

 function Example() {
   // Declare a new state variable, which we'll call "count"
   const [count, setCount] = useState(0);

   return (
     <>
       <p>You clicked {count} times</p>
       <button onClick={() => setCount(count + 1)}>Click me</button>
     </>
   );
 }
 ```

 **Note:** Hooks can be used inside an existing function component without rewriting the component.

### How to ensure hooks followed the rules in your project?
React team released an ESLint plugin called **eslint-plugin-react-hooks** that enforces Hook's two rules. It is part of Hooks API. You can add this plugin to your project using the below command,

    ```javascript
    npm install eslint-plugin-react-hooks --save-dev
    ```

    And apply the below config in your ESLint config file,

    ```javascript
    // Your ESLint configuration
    {
      "plugins": [
        // ...
        "react-hooks"
      ],
      "rules": {
        // ...
        "react-hooks/rules-of-hooks": "error"
      }
    }
    ```

    This plugin also provide another important rule through `react-hooks/exhaustive-deps`. It ensures that the dependencies of useEffect, useCallback, and useMemo hooks are correctly listed to avoid potential bugs.

    ```jsx
    useEffect(() => {
      // Forgetting `message` will result in incorrect behavior
      console.log(message);
    }, []); // Here `message` should be a dependency
    ```
    The recommended `eslint-config-react-app` preset already includes the hooks rules of this plugin.
    For example, the linter enforce proper naming convention for hooks. If you rename your custom hooks which as prefix "use" to something else then linter won't allow you to call built-in hooks such as useState, useEffect etc inside of your custom hook anymore.

    **Note:** This plugin is intended to use in Create React App by default.

### What is the proper placement for error boundaries?
The granularity of error boundaries usage is up to the developer based on project needs. You can follow either of these approaches,
 1. You can wrap top-level route components to display a generic error message for the entire application.
 2. You can also wrap individual components in an error boundary to protect them from crashing the rest of the application.

### What is the benefit of component stack trace from error boundary?
Apart from error messages and javascript stack, React16 will display the component stack trace with file names and line numbers using error boundary concept.

 For example, BuggyCounter component displays the component stack trace as below,

 ![stacktrace](images/error_boundary.png)

### What is code-splitting?
Code-Splitting is a feature supported by bundlers like Webpack and Browserify which can create multiple bundles that can be dynamically loaded at runtime. The react project supports code splitting via dynamic import() feature.

 For example, in the below code snippets, it will make moduleA.js and all its unique dependencies as a separate chunk that only loads after the user clicks the 'Load' button.

 **moduleA.js**

 ```javascript
 const moduleA = "Hello";

 export { moduleA };
 ```

 **App.js**

 ```javascript
 export default function App {
   function handleClick() {
     import("./moduleA")
       .then(({ moduleA }) => {
         // Use moduleA
       })
       .catch((err) => {
         // Handle failure
       });
   };

  return (
    <div>
      <button onClick={this.handleClick}>Load</button>
    </div>
  );
 }
 ```

  <details><summary><b>See Class</b></summary>
<p>

  ```javascript
import React, { Component } from "react";

 class App extends Component {
   handleClick = () => {
     import("./moduleA")
       .then(({ moduleA }) => {
         // Use moduleA
       })
       .catch((err) => {
         // Handle failure
       });
   };

   render() {
     return (
       <div>
         <button onClick={this.handleClick}>Load</button>
       </div>
     );
   }
 }

 export default App;
  ```

  </p>
</details>

### What are Keyed Fragments?
The Fragments declared with the explicit <React.Fragment> syntax may have keys. The general use case is mapping a collection to an array of fragments as below,

 ```javascript
 function Glossary(props) {
   return (
     <dl>
       {props.items.map((item) => (
         // Without the `key`, React will fire a key warning
         <React.Fragment key={item.id}>
           <dt>{item.term}</dt>
           <dd>{item.description}</dd>
         </React.Fragment>
       ))}
     </dl>
   );
 }
 ```

 **Note:** key is the only attribute that can be passed to Fragment. In the future, there might be a support for additional attributes, such as event handlers.

### How do you pass an event handler to a component?
You can pass event handlers and other functions as props to child components. The functions can be passed to child component as below,

 ```jsx
 function Button({ onClick }) {
   return <button onClick={onClick}>Download</button>;
 }

 export default function downloadExcel() {
   function handleClick() {
     alert("Downloaded");
   }

   return <Button onClick={handleClick}></Button>;
 }
 ```

### How to prevent a function from being called multiple times?
If you use an event handler such as **onClick or onScroll** and want to prevent the callback from being fired too quickly, then you can limit the rate at which callback is executed. This can be achieved in the below possible ways,

 1. **Throttling:** Changes based on a time based frequency. For example, it can be used using \_.throttle lodash function
 2. **Debouncing:** Publish changes after a period of inactivity. For example, it can be used using \_.debounce lodash function
 3. **RequestAnimationFrame throttling:** Changes based on requestAnimationFrame. For example, it can be used using raf-schd lodash function

### How do you update rendered elements?
You can update UI(represented by rendered element) by passing the newly created element to ReactDOM's render method.

 For example, lets take a ticking clock example, where it updates the time by calling render method multiple times,

 ```javascript
 function tick() {
   const element = (
     <div>
       <h1>Hello, world!</h1>
       <h2>It is {new Date().toLocaleTimeString()}.</h2>
     </div>
   );
   ReactDOM.render(element, document.getElementById("root"));
 }

 setInterval(tick, 1000);
 ```

### How do you say that props are readonly?
When you declare a component as a function or a class, it must never modify its own props.

 Let us take a below capital function,

 ```javascript
 function capital(amount, interest) {
   return amount + interest;
 }
 ```

 The above function is called “pure” because it does not attempt to change their inputs, and always return the same result for the same inputs. Hence, React has a single rule saying "All React components must act like pure functions with respect to their props."

### What are the conditions to safely use the index as a key?
There are three conditions to make sure, it is safe use the index as a key.

 1. The list and items are static– they are not computed and do not change
 2. The items in the list have no ids
 3. The list is never reordered or filtered.

### Why are you not required to use inheritance?
In React, it is recommended to use composition over inheritance to reuse code between components. Both Props and composition give you all the flexibility you need to customize a component’s look and behavior explicitly and safely.
 Whereas, If you want to reuse non-UI functionality between components, it is suggested to extract it into a separate JavaScript module. Later components import it and use that function, object, or class, without extending it.

### What is suspense component?
React Suspense is a built-in feature that lets you defer rendering part of your component tree until some condition(asynchronous operation) is met,usually, data or code has finished loading. While waiting, Suspense lets you display a fallback UI like a spinner or placeholder.


 1. Lazy loading components uses suspense feature,


    If the module containing the dynamic import is not yet loaded by the time parent component renders, you must show some fallback content while you’re waiting for it to load using a loading indicator. This can be done using **Suspense** component.

    ```javascript
    const OtherComponent = React.lazy(() => import("./OtherComponent"));

    function MyComponent() {
      return (
        <div>
          <Suspense fallback={<div>Loading...</div>}>
            <OtherComponent />
          </Suspense>
        </div>
      );
    }
    ```
    The above component shows fallback UI instead real component until `OtherComponent` is fully loaded.

 2. As an another example, suspend until async data(data fetching) is ready
  ```jsx
    function UserProfile() {
      const user = use(fetchUser()); // throws a promise internally
      return <div>{user.name}</div>;
    }

    function App() {
      return (
        <Suspense fallback={<div>Loading user...</div>}>
          <UserProfile />
        </Suspense>
      );
    }

```

### What is route based code splitting?
One of the best place to do code splitting is with routes. The entire page is going to re-render at once so users are unlikely to interact with other elements in the page at the same time. Due to this, the user experience won't be disturbed.

 Let us take an example of route based website using libraries like React Router with React.lazy,

 ```javascript
 import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
 import React, { Suspense, lazy } from "react";

 const Home = lazy(() => import("./routes/Home"));
 const About = lazy(() => import("./routes/About"));

 const App = () => (
   <Router>
     <Suspense fallback={<div>Loading...</div>}>
       <Switch>
         <Route exact path="/" component={Home} />
         <Route path="/about" component={About} />
       </Switch>
     </Suspense>
   </Router>
 );
 ```

 In the above code, the code splitting will happen at each route level.

### What is the purpose of default value in context?
The defaultValue argument is only used when a component does not have a matching Provider above it in the tree. This can be helpful for testing components in isolation without wrapping them.

 Below code snippet provides default theme value as Luna.

 ```javascript
 const MyContext = React.createContext(defaultValue);
 ```

### What are the problems of using render props with pure components?
If you create a function inside a render method, it negates the purpose of pure component. Because the shallow prop comparison will always return false for new props, and each render in this case will generate a new value for the render prop. You can solve this issue by defining the render function as instance method.

### How do you print falsy values in JSX?
The falsy values such as false, null, undefined, and true are valid children but they don't render anything. If you still want to display them then you need to convert it to string. Let's take an example on how to convert to a string,

 ```javascript
 <div>My JavaScript variable is {String(myVariable)}.</div>
 ```

### What is the typical use case of portals?
React Portals are primarily used to render UI components such as **modals, tooltips, dropdowns, hovercards, and notifications** outside of their parent component's DOM tree. This helps avoid common CSS issues caused by parent elements, such as:

 *   `**overflow: hidden**` on parent elements clipping or hiding child elements like modals or tooltips,
 *   **stacking context and** `**z-index**` **conflicts** created by parent containers that prevent child elements from appearing above other content.

 That means, you need to visually “break out” of its container. By rendering these UI elements into a separate DOM node (often directly under `<body>`), portals ensure they appear above all other content and are not restricted by the parent’s CSS or layout constraints, resulting in correct positioning and visibility regardless of the parent’s styling.

### How do you set default value for uncontrolled component?
In React, the value attribute on form elements will override the value in the DOM. With an uncontrolled component, you might want React to specify the initial value, but leave subsequent updates uncontrolled. To handle this case, you can specify a **defaultValue** attribute instead of **value**.

 ```javascript
 render() {
   return (
     <form onSubmit={this.handleSubmit}>
       <label>
         User Name:
         <input
           defaultValue="John"
           type="text"
           ref={this.input} />
       </label>
       <input type="submit" value="Submit" />
     </form>
   );
 }
 ```

 The same applies for `select` and `textArea` inputs. But you need to use **defaultChecked** for `checkbox` and `radio` inputs.

### What is the difference between Real DOM and Virtual DOM?
Below are the main differences between Real DOM and Virtual DOM,

 | Real DOM                             | Virtual DOM                          |
 | ------------------------------------ | ------------------------------------ |
 | Updates are slow                     | Updates are fast                     |
 | DOM manipulation is very expensive.  | DOM manipulation is very easy        |
 | You can update HTML directly.        | You Can’t directly update HTML       |
 | It causes too much of memory wastage | There is no memory wastage           |
 | Creates a new DOM if element updates | It updates the JSX if element update |

### What is useEffect hook? How to fetch data with React Hooks?
The `useEffect` hook is a React Hook that lets you perform **side effects** in function components. Side effects are operations that interact with the outside world or system and aren't directly related to rendering UI, such as fetching data, setting up subscriptions, timers, manually manipulating the DOM, etc.

 In function components, useEffect replaces the class component lifecycle methods(`componentDidMount`, `componentDidUpdate` and `componentWillUnmount`) with a single, unified API.     

 **Syntax**
 ```js
 useEffect(() => {
    // Side effect logic here

    return () => {
    // Cleanup logic (optional)
    };
    }, [dependencies]);
 ```
 This effect hook can be used to fetch data from an API and to set the data in the local state of the component with the useState hook’s update function.

 Here is an example of fetching a list of ReactJS articles from an API using fetch.

 ```javascript
 import React from "react";

 function App() {
   const [data, setData] = React.useState({ hits: [] });

   React.useEffect(() => {
     fetch("http://hn.algolia.com/api/v1/search?query=react")
       .then((response) => response.json())
       .then((data) => setData(data));
   }, []);

   return (
     <ul>
       {data.hits.map((item) => (
         <li key={item.objectID}>
           <a href={item.url}>{item.title}</a>
         </li>
       ))}
     </ul>
   );
 }

 export default App;
 ```

 A popular way to simplify this is by using the library axios.

 We provided an empty array as second argument to the useEffect hook to avoid activating it on component updates. This way, it only fetches on component mount.

### What is the stable release for hooks support?
React includes a stable implementation of React Hooks in 16.8 release for below packages

 1. React DOM
 2. React DOM Server
 3. React Test Renderer
 4. React Shallow Renderer

### What are the sources used for introducing hooks?
Hooks got the ideas from several different sources. Below are some of them,

 1. Previous experiments with functional APIs in the react-future repository
 2. Community experiments with render prop APIs such as Reactions Component
 3. State variables and state cells in DisplayScript.
 4. Subscriptions in Rx.
 5. Reducer components in ReasonReact.

### What is the purpose of eslint plugin for hooks?
The ESLint plugin enforces rules of Hooks to avoid bugs. It assumes that any function starting with ”use” and a capital letter right after it is a Hook. In particular, the rule enforces that,

 1. Calls to Hooks are either inside a PascalCase function (assumed to be a component) or another useSomething function (assumed to be a custom Hook).
 2. Hooks are called in the same order on every render.

### How do you make sure that user remains authenticated on page refresh while using Context API State Management?
When a user logs in and reload, to persist the state generally we add the load user action in the useEffect hooks in the main App.js. While using Redux, loadUser action can be easily accessed.

 **App.js**

 ```js
 import { loadUser } from "../actions/auth";
 store.dispatch(loadUser());
 ```

 - But while using **Context API**, to access context in App.js, wrap the AuthState in index.js so that App.js can access the auth context. Now whenever the page reloads, no matter what route you are on, the user will be authenticated as **loadUser** action will be triggered on each re-render.

 **index.js**

 ```js
 import React from "react";
 import ReactDOM from "react-dom";
 import App from "./App";
 import AuthState from "./context/auth/AuthState";

 ReactDOM.render(
   <React.StrictMode>
     <AuthState>
       <App />
     </AuthState>
   </React.StrictMode>,
   document.getElementById("root")
 );
 ```

 **App.js**

 ```js
 const authContext = useContext(AuthContext);

 const { loadUser } = authContext;

 useEffect(() => {
   loadUser();
 }, []);
 ```

 **loadUser**

 ```js
 const loadUser = async () => {
   const token = sessionStorage.getItem("token");

   if (!token) {
     dispatch({
       type: ERROR,
     });
   }
   setAuthToken(token);

   try {
     const res = await axios("/api/auth");

     dispatch({
       type: USER_LOADED,
       payload: res.data.data,
     });
   } catch (err) {
     console.error(err);
   }
 };
 ```

### What is the difference between useState and useRef hook?
1. useState causes components to re-render after state updates whereas useRef doesn’t cause a component to re-render when the value or state changes.
    Essentially, useRef is like a “box” that can hold a mutable value in its (`.current`) property.
 2. useState allows us to update the state inside components. While useRef allows referencing DOM elements and tracking values.

### What are the differences between useEffect and useLayoutEffect hooks?
useEffect and useLayoutEffect are both React hooks that can be used to synchronize a component with an external system, such as a browser API or a third-party library. However, there are some key differences between the two:

 - Timing: useEffect runs after the browser has finished painting, while useLayoutEffect runs synchronously before the browser paints. This means that useLayoutEffect can be used to measure and update layout in a way that feels more synchronous to the user.

 - Browser Paint: useEffect allows browser to paint the changes before running the effect, hence it may cause some visual flicker. useLayoutEffect synchronously runs the effect before browser paints and hence it will avoid visual flicker.

 - Execution Order: The order in which multiple useEffect hooks are executed is determined by React and may not be predictable. However, the order in which multiple useLayoutEffect hooks are executed is determined by the order in which they were called.

 - Error handling: useEffect has a built-in mechanism for handling errors that occur during the execution of the effect, so that it does not crash the entire application. useLayoutEffect does not have this mechanism, and errors that occur during the execution of the effect will crash the entire application.

 In general, it's recommended to use useEffect as much as possible, because it is more performant and less prone to errors. useLayoutEffect should only be used when you need to measure or update layout, and you can't achieve the same result using useEffect.

### Why does strict mode render twice in React?
StrictMode renders components twice in development mode(not production) in order to detect any problems with your code and warn you about those problems. This is used to detect accidental side effects in the render phase. If you used `create-react-app` development tool then it automatically enables StrictMode by default.

 ```js
 const root = createRoot(document.getElementById("root"));
 root.render(
   <StrictMode>
     <App />
   </StrictMode>
 );
 ```

 If you want to disable this behavior then you can simply remove `strict` mode.

 ```js
 const root = createRoot(document.getElementById("root"));
 root.render(<App />);
 ```

 To detect side effects the following functions are invoked twice:

 1. Function component bodies, excluding the code inside event handlers.
 2. Functions passed to `useState`, `useMemo`, or `useReducer` (any other Hook)
 3. Class component's `constructor`, `render`, and `shouldComponentUpdate` methods
 4. Class component static `getDerivedStateFromProps` method
 5. State updater functions

### How do you prevent mutating array variables?
The preexisting variables outside of the function scope including state, props and context leads to a mutation and they result in unpredictable bugs during the rendering stage. The below points should be taken care while working with arrays variables.

  1. You need to take copy of the original array and perform array operations on it for the rendering purpose. This is called local mutation.
  2. Avoid triggering mutation methods such as push, pop, sort and reverse methods on original array. It is safe to use filter, map and slice method because they create a new array.

### How do you update objects inside state?
You cannot update the objects which exists in the state directly. Instead, you should create a fresh new object (or copy from the existing object) and update the latest state using the newly created object. Eventhough JavaScript objects are mutable, you need to treat objects inside state as read-only while updating the state.

  Let's see this comparison with an example. The issue with regular object mutation approach can be described by updating the user details fields of `Profile` component. The properties of `Profile` component such as firstName, lastName and age details mutated in an event handler as shown below.

  ```jsx
  import { useState } from "react";

  export default function Profile() {
    const [user, setUser] = useState({
      firstName: "John",
      lastName: "Abraham",
      age: 30,
    });

    function handleFirstNameChange(e) {
      user.firstName = e.target.value;
    }

    function handleLastNameChange(e) {
      user.lastName = e.target.value;
    }

    function handleAgeChange(e) {
      user.age = e.target.value;
    }

    return (
      <>
        <label>
          First name:
          <input value={user.firstName} onChange={handleFirstNameChange} />
        </label>
        <label>
          Last name:
          <input value={user.lastName} onChange={handleLastNameChange} />
        </label>
        <label>
          Age:
          <input value={user.age} onChange={handleAgeChange} />
        </label>
        <p>
          Profile:
          {person.firstName} {person.lastName} ({person.age})
        </p>
      </>
    );
  }
  ```

  Once you run the application with above user profile component, you can observe that user profile details won't be update upon entering the input fields.
  This issue can be fixed by creating a new copy of object which includes existing properties through spread syntax(...obj) and add changed values in a single event handler itself as shown below.

  ```jsx
  handleProfileChange(e) {
    setUser({
    ...user,
      [e.target.name]: e.target.value
    });
  }
  ```

  The above event handler is concise instead of maintaining separate event handler for each field. Now, UI displays the updated field values as expected without an issue.

### How do you update nested objects inside state?
You cannot simply use spread syntax for all kinds of objects inside state. Because spread syntax is shallow and it copies properties for one level deep only. If the object has nested object structure, UI doesn't work as expected with regular JavaScript nested property mutation. Let's demonstrate this behavior with an example of User object which has address nested object inside of it.

  ```jsx
  const user = {
    name: "John",
    age: 32,
    address: {
      country: "Singapore",
      postalCode: 440004,
    },
  };
  ```

  If you try to update the country nested field in a regular javascript fashion(as shown below) then user profile screen won't be updated with latest value.

  ```js
  user.address.country = "Germany";
  ```

  This issue can be fixed by flattening all the fields into a top-level object or create a new object for each nested object and point it to it's parent object. In this example, first you need to create copy of address object and update it with the latest value. Later, the address object should be linked to parent user object something like below.

  ```js
  setUser({
    ...user,
    address: {
      ...user.address,
      country: "Germany",
    },
  });
  ```

  This approach is bit verbose and not easy for deep hierarchical state updates. But this workaround can be used for few levels of nested objects without much hassle.

### How do you update arrays inside state?
Eventhough arrays in JavaScript are mutable in nature, you need to treat them as immutable while storing them in a state. That means, similar to objects, the arrays cannot be updated directly inside state. Instead, you need to create a copy of the existing array and then set the state to use newly copied array.

  To ensure that arrays are not mutated, the mutation operations like direct direct assignment(arr[1]='one'), push, pop, shift, unshift, splice etc methods should be avoided on original array. Instead, you can create a copy of existing array with help of array operations such as filter, map, slice, spread syntax etc.

  For example, the below push operation doesn't add the new todo to the total todo's list in an event handler.

  ```jsx
  onClick = {
    todos.push({
      id: id+1,
      name: name
    })
  }
  ```

  This issue is fixed by replacing push operation with spread syntax where it will create a new array and the UI updated with new todo.

  ```jsx
  onClick = {
    [
      ...todos,
      { id: id+1, name: name }
    ]
  }
  ```

### How do you use immer library for state updates?
Immer library enforces the immutability of state based on **copy-on-write** mechanism. It uses JavaScript proxy to keep track of updates to immutable states. Immer has 3 main states as below,

  1. **Current state:** It refers to actual state
  2. **Draft state:** All new changes will be applied to this state. In this state, draft is just a proxy of the current state.
  3. **Next state:** It is formed after all mutations applied to the draft state

  Immer can be used by following below instructions,

  1. Install the dependency using `npm install use-immer` command
  2. Replace `useState` hook with `useImmer` hook by importing at the top
  3. The setter function of `useImmer` hook can be used to update the state.

  For example, the mutation syntax of immer library simplifies the nested address object of user state as follows,

  ```jsx
  import { useImmer } from "use-immer";
  const [user, setUser] = useImmer({
    name: "John",
    age: 32,
    address: {
      country: "Singapore",
      postalCode: 440004,
    },
  });

  //Update user details upon any event
  setUser((draft) => {
    draft.address.country = "Germany";
  });
  ```

  The preceding code enables you to update nested objects with a conceise mutation syntax.

### What is useContext? What are the steps to follow for useContext?
The `useContext` hook is a built-in React Hook that lets you access the value of a context inside a functional component without needing to wrap it in a <Context.Consumer> component.

 It helps you **avoid prop drilling** (passing props through multiple levels) by allowing components to access shared data like themes, authentication status, or user preferences.

 The usage of useContext involves three main steps:
  #### **Step 1 : Create the Context**

    Use `React.createContext()` to create a context object.

    ```jsx
    import React, { createContext } from 'react'; 

    const ThemeContext = createContext(); // default value optional
    ```

  You typically export this so other components can import it.

  #### **Step 2: Provide the Context Value**

    Wrap your component tree (or a part of it) with the `Context.Provider` and pass a `value` prop.

    ```jsx
    function App() {
        return ( 
            <ThemeContext.Provider value="dark">
               <MyComponent />
            </ThemeContext.Provider>
        ); 
    }
    ```

    Now any component inside `<ThemeContext.Provider>` can access the context value.

    #### **Step 3: Consume the Context with** `**useContext**`

    In any functional component **inside the Provider**, use the `useContext` hook:

    ```jsx
    import { useContext } from 'react'; 
    function MyComponent() {
        const theme = useContext(ThemeContext); // theme = "dark"
        return <p>Current Theme: {theme}</p>; 
    }
    ```

### What are the use cases of useContext hook?
The `useContext` hook in React is used to share data across components without having to pass props manually through each level. Here are some common and effective use cases:

    1.  **Theme Customization**  
        `useContext` can be used to manage application-wide themes, such as light and dark modes, ensuring consistent styling and enabling user-driven customization.
    2.  **Localization and Internationalization**  
        It supports localization by providing translated strings or locale-specific content to components, adapting the application for users in different regions.
    3.  **User Authentication and Session Management**  
        `useContext` allows global access to authentication status and user data. This enables conditional rendering of components and helps manage protected routes or user-specific UI elements.
    4.  **Shared Modal or Sidebar Visibility**  
        It's ideal for managing the visibility of shared UI components like modals, drawers, or sidebars, especially when their state needs to be controlled from various parts of the app.
    5.  **Combining with** `**useReducer**` **for Global State Management**  
        When combined with `useReducer`, `useContext` becomes a powerful tool for managing more complex global state logic. This pattern helps maintain cleaner, scalable state logic without introducing external libraries like Redux.
         Some of the common use cases of useContext are listed below,

### When to use client and server components?
You can efficiently build nextjs application if you are aware about which part of the application needs to use client components and which other parts needs to use server components. The common cases of both client and server components are listed below:

    **Client components:**
    1. Whenever your need to add interactivity and event listeners such as onClick(), onChange(), etc to the pages
    2. If you need to use State and Lifecycle Effects like useState(), useReducer(), useEffect() etc.
    3. If there is a requirement to use browser-only APIs.
    4. If you need to implement custom hooks that depend on state, effects, or browser-only APIs.
    5. There are React Class components in the pages.

    **Server components:**
    1. If the component logic is about data fetching.
    2. If you need to access backend resources directly.
    3. When you need to keep sensitive information((access tokens, API keys, etc)	) on the server.
    4. If you want reduce client-side JavaScript and placing large dependencies on the server.

### What is `useReducer`? Why do you use useReducer?
The `useReducer` hook is a React hook used to manage **complex state logic** inside **functional components**. It is conceptually similar to **Redux**. i.e, Instead of directly updating state like with `useState`, you **dispatch an action** to a **reducer function**, and the reducer returns the new state.

 The `useReducer` hook takes three arguments:

    ```js
    const [state, dispatch] = useReducer(reducer, initialState, initFunction);
    ```

    *   `**reducer**`: A function `(state, action) => newState` that handles how state should change based on the action.
    *   `**initialState**`: The starting state.
    *   `**dispatch**`: A function you call to trigger an update by passing an action.

 The `useReducer` hook is used when:

 *   The **state is complex**, such as nested structures or multiple related values.
 *   State updates depend on the **previous state** and **logic**.
 *   You want to **separate state update logic** from UI code to make it cleaner and testable.
 *   You’re managing features like:
     *   Forms
     *   Wizards / Multi-step flows
     *   Undo/Redo functionality
     *   Shopping cart logic
     *   Toggle & conditional UI logic

### How to prevent infinite loops with useEffect?
Infinite loops happen when the effect updates state that’s listed in its own dependency array, which causes the effect to re-run, updating state again and so on.
    
    **Infinite loop scenario:**
    ```js
    useEffect(() => {
      setCount(count + 1);
    }, [count]); // Triggers again every time count updates
    ```
    You need to ensure that setState calls do not depend on values that cause the effect to rerun, or isolate them with a guard.
    ```js
    useEffect(() => {
      if (count < 5) {
        setCount(count + 1);
      }
    }, [count]);
    ```

### How Do You Use useRef to Access a DOM Element in React? Give an example.
The `useRef` hook is commonly used in React to directly reference and interact with DOM elements, like focusing an input, scrolling to a section, or controlling media elements.
    
    When you assign a ref to a DOM element using useRef, React gives you access to the underlying DOM node via the .current property of the ref object.
    
    **Example: Focus an input**

    ```js
    import React, { useRef } from 'react';
    
    function FocusInput() {
      const inputRef = useRef(null); // create the ref
    
      const handleFocus = () => {
        inputRef.current.focus(); // access DOM element and focus it
      };
    
      return (
        <div>
          <input type="text" ref={inputRef} />
          <button onClick={handleFocus}>Focus the input</button>
        </div>
      );
    }
    ```
   **Note:** The DOM reference is only available **after the component has mounted**, typically accessed in `useEffect` or event handlers.

### What are the common usecases of useRef hook?
Some of the common cases are:
  *   Automatically focus an input when a component mounts.
  *   Scroll to a specific element.
  *   Measure element dimensions (`offsetWidth`, `clientHeight`).
  *   Control video/audio playback.
  *   Integrate with non-React libraries (like D3 or jQuery).

### What is useImperativeHandle Hook? Give an example.
`useImperativeHandle` is a React Hook that allows a **child component** to expose **custom functions or properties** to its **parent component**, when using `ref`.
  It is typically used with `forwardRef` and is very useful in cases like **modals**, **dialogs**, **custom inputs**, etc., where the parent needs to **control behavior imperatively** (e.g., open, close, reset).

  **Example: Dialog component**
  ```js
  import React, {
    useRef,
    useState,
    useImperativeHandle,
    forwardRef,
  } from 'react';
  import './Dialog.css'; 

  const Dialog = forwardRef((props, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState('');

    useImperativeHandle(ref, () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      reset: () => setFormData(''),
    }));

    if (!isOpen) return null;

    return (
      <div className="dialog"> 
        <h2>Dialog</h2>
        <input
          type="text"
          value={formData}
          placeholder="Type something..."
          onChange={(e) => setFormData(e.target.value)}
        />
        <br />
        <button onClick={() => setIsOpen(false)}>Close</button>
      </div>
    );
  });

  function Parent() {
    const dialogRef = useRef();

    return (
      <div>
        <h1>useImperativeHandle Dialog Example</h1>
        <button onClick={() => dialogRef.current.open()}>Open Dialog</button>
        <button onClick={() => dialogRef.current.reset()}>Reset Dialog</button>
        <button onClick={() => dialogRef.current.close()}>Close Dialog</button>

        <Dialog ref={dialogRef} />
      </div>
    );
  }

  export default Parent;
  ```

### When should you use useImperativeHandle?
The useImperativeHandler hook will be used in below cases:

  *   You want to expose **imperative methods** from a child component 
        - Custom input controls exposing `focus`, `clear`, or `validate` methods
        - Modal components exposing `open()` and `close()` methods
        - Scroll containers exposing `scrollToTop()` or `scrollToBottom()` methods
  *   You want to **hide internal implementation** but provide controlled external access.
  *   You're building **reusable component libraries** (e.g., inputs, modals, form controls).

### What is `useCallback` and why is it used?
The `useCallback` is a React Hook used to memoize **function definitions** between renders. It returns the same function reference unless its dependencies change. This is especially useful when passing callbacks to optimized child components (e.g. those wrapped in `React.memo`) to prevent unnecessary re-renders.
    
    **Example:**
    
    ```css
    const handleClick = useCallback(() => {
      console.log('Button clicked');
    }, []);
    ```
    
    Without `useCallback`, a new function is created on every render, potentially causing child components to re-render unnecessarily.

### What are Custom React Hooks, and How Can You Develop One?
**Custom Hooks** in React are JavaScript functions that allow you to **extract and reuse component logic** using React’s built-in Hooks like `useState`, `useEffect`, etc.

  They start with the word **"use"** and let you encapsulate logic that multiple components might share,such as fetching data, handling forms, or managing timers,without repeating code.

  Let's explain the custom hook usage with `useFetchData` example. The `useFetchData` custom Hook is a reusable function in React that simplifies the process of fetching data from an API. It encapsulates common logic such as initiating the fetch request, managing loading and error states, and storing the fetched data. By using built-in Hooks like `useState` and `useEffect`, `useFetchData` provides a clean interface that returns the `data`, `loading`, and `error` values, which can be directly used in components.

  ```jsx
  import { useState, useEffect } from 'react';

  function useFetchData(url) {
    const [data, setData] = useState(null);     // Holds the response
    const [loading, setLoading] = useState(true); // Loading state
    const [error, setError] = useState(null);     // Error state

    useEffect(() => {
      let isMounted = true; // Prevent setting state on unmounted component
      setLoading(true);

      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error('Network response was not ok');
          return response.json();
        })
        .then((json) => {
          if (isMounted) {
            setData(json);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err.message);
            setLoading(false);
          }
        });

      return () => {
        isMounted = false; // Clean-up function to avoid memory leaks
      };
    }, [url]);

    return { data, loading, error };
  }
  ```

  The above custom hook can be used to retrieve users data for `AuthorList`, `ReviewerList` components.

  **Example: AuthorList component**
  ```jsx
  function AuthorList() {
    const { data, loading, error } = useFetchData('https://api.example.com/authors');

    if (loading) return <p>Loading authors...</p>;
    if (error) return <p>Error: {error}</p>;

    return (
      <ul>
        {data.map((author) => (
          <li key={author.id}>{author.name}</li>
        ))}
      </ul>
    );
  }
  ```
 
  Some of the benefits of custom hooks are:
   *   Promotes **code reuse**
   *   Keeps components **clean and focused**
   *   Makes complex logic **easier to test and maintain**

### What is the useId hook and when should you use it?
The `useId` hook is a React hook introduced in React 18 that generates **unique IDs** that are stable across server and client renders. It's primarily used for **accessibility attributes** like linking form labels to inputs.

 #### Syntax
 ```js
 const id = useId();
 ```

 #### Example: Accessible Form Input
 ```jsx
 import { useId } from 'react';

 function EmailField() {
   const id = useId();
   
   return (
     <div>
       <label htmlFor={id}>Email:</label>
       <input id={id} type="email" />
     </div>
   );
 }
 ```

 #### When to Use
 - Generating unique IDs for form elements (`htmlFor`, `aria-describedby`, `aria-labelledby`)
 - Creating stable IDs in server-side rendering (SSR) applications
 - Avoiding ID collisions when the same component is rendered multiple times

 #### When NOT to Use
 - As keys in a list (use data-based keys instead)
 - As CSS selectors or query selectors
 - For any purpose that requires the ID to be predictable

 **Note:** The IDs generated by `useId` contain colons (`:`) which may not work in CSS selectors. For multiple related IDs, you can use the same `id` as a prefix: `${id}-firstName`, `${id}-lastName`.

### What is the useDeferredValue hook?
The `useDeferredValue` hook is used to **defer updating a part of the UI** to keep other parts responsive. It accepts a value and returns a "deferred" version of that value that may lag behind. This is useful for optimizing performance when rendering expensive components.

 #### Syntax
 ```js
 const deferredValue = useDeferredValue(value);
 ```

 #### Example: Search with Deferred Results
 ```jsx
 import { useState, useDeferredValue, useMemo } from 'react';

 function SearchResults({ query }) {
   // Expensive computation or large list filtering
   const results = useMemo(() => {
     return largeDataSet.filter(item => 
       item.name.toLowerCase().includes(query.toLowerCase())
     );
   }, [query]);

   return (
     <ul>
       {results.map(item => <li key={item.id}>{item.name}</li>)}
     </ul>
   );
 }

 function SearchPage() {
   const [query, setQuery] = useState('');
   const deferredQuery = useDeferredValue(query);
   const isStale = query !== deferredQuery;

   return (
     <div>
       <input 
         value={query} 
         onChange={(e) => setQuery(e.target.value)}
         placeholder="Search..."
       />
       <div style={{ opacity: isStale ? 0.5 : 1 }}>
         <SearchResults query={deferredQuery} />
       </div>
     </div>
   );
 }
 ```

 The input stays responsive while the expensive `SearchResults` component re-renders with a slight delay using the deferred value.

### What is the useTransition hook and how does it differ from useDeferredValue?
The `useTransition` hook allows you to mark certain state updates as **non-urgent transitions**, keeping the UI responsive during expensive re-renders. It returns a `isPending` flag and a `startTransition` function.

 #### Syntax
 ```js
 const [isPending, startTransition] = useTransition();
 ```

 #### Example: Tab Switching
 ```jsx
 import { useState, useTransition } from 'react';

 function TabContainer() {
   const [isPending, startTransition] = useTransition();
   const [tab, setTab] = useState('home');

   function selectTab(nextTab) {
     startTransition(() => {
       setTab(nextTab);
     });
   }

   return (
     <div>
       <button onClick={() => selectTab('home')}>Home</button>
       <button onClick={() => selectTab('posts')}>Posts (slow)</button>
       <button onClick={() => selectTab('contact')}>Contact</button>
       
       {isPending && <Spinner />}
       
       {tab === 'home' && <HomeTab />}
       {tab === 'posts' && <PostsTab />}  {/* Expensive component */}
       {tab === 'contact' && <ContactTab />}
     </div>
   );
 }
 ```

 #### Differences from useDeferredValue

 | Feature | useTransition | useDeferredValue |
 |---------|--------------|------------------|
 | Controls | State updates (wraps `setState`) | Values (wraps a value) |
 | Use case | When you control the state update | When you receive a value from props or other hooks |
 | Returns | `[isPending, startTransition]` | Deferred value |
 | Pending state | Built-in `isPending` flag | Manual comparison needed |

### What is the useSyncExternalStore hook?
The `useSyncExternalStore` hook is designed to **subscribe to external stores** (non-React state sources) in a way that's compatible with concurrent rendering. It's primarily used by library authors for state management libraries.

 #### Syntax
 ```js
 const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?);
 ```

 - **subscribe**: Function to subscribe to the store, returns an unsubscribe function
 - **getSnapshot**: Function that returns the current store value
 - **getServerSnapshot**: Optional function for SSR that returns the initial server snapshot

 #### Example: Browser Online Status
 ```jsx
 import { useSyncExternalStore } from 'react';

 function getSnapshot() {
   return navigator.onLine;
 }

 function subscribe(callback) {
   window.addEventListener('online', callback);
   window.addEventListener('offline', callback);
   return () => {
     window.removeEventListener('online', callback);
     window.removeEventListener('offline', callback);
   };
 }

 function useOnlineStatus() {
   return useSyncExternalStore(subscribe, getSnapshot, () => true);
 }

 function StatusBar() {
   const isOnline = useOnlineStatus();
   return <h1>{isOnline ? '✅ Online' : '❌ Disconnected'}</h1>;
 }
 ```

 This hook ensures that when the external store changes, React re-renders consistently without tearing (showing inconsistent data).

### What is the useInsertionEffect hook?
The `useInsertionEffect` hook is designed for **CSS-in-JS library authors** to inject styles into the DOM before any layout effects run. It fires synchronously before DOM mutations.

 #### Syntax
 ```js
 useInsertionEffect(() => {
   // Insert styles here
   return () => {
     // Cleanup
   };
 }, [dependencies]);
 ```

 #### Execution Order
 ```
 1. useInsertionEffect  → Inject styles
 2. DOM mutations       → React updates DOM
 3. useLayoutEffect     → Read layout, synchronously re-render if needed
 4. Browser paint       → User sees the result
 5. useEffect           → Side effects run
 ```

 #### Example: Dynamic Style Injection
 ```jsx
 import { useInsertionEffect } from 'react';

 let isInserted = new Set();

 function useCSS(rule) {
   useInsertionEffect(() => {
     if (!isInserted.has(rule)) {
       isInserted.add(rule);
       const style = document.createElement('style');
       style.textContent = rule;
       document.head.appendChild(style);
     }
   }, [rule]);
 }

 function Button() {
   useCSS('.dynamic-btn { background: blue; color: white; }');
   return <button className="dynamic-btn">Click me</button>;
 }
 ```

 **Note:** This hook is not intended for application code. It's specifically for CSS-in-JS libraries like styled-components or Emotion to prevent style flickering.

### How do you share state logic between components using custom hooks?
Custom hooks allow you to **extract and share stateful logic** between components without changing their hierarchy. The state itself is not shared,each component using the hook gets its own isolated state.

 #### Example: useLocalStorage Hook
 ```jsx
 import { useState, useEffect } from 'react';

 function useLocalStorage(key, initialValue) {
   // Get stored value or use initial value
   const [storedValue, setStoredValue] = useState(() => {
     try {
       const item = window.localStorage.getItem(key);
       return item ? JSON.parse(item) : initialValue;
     } catch (error) {
       console.error(error);
       return initialValue;
     }
   });

   // Update localStorage when state changes
   useEffect(() => {
     try {
       window.localStorage.setItem(key, JSON.stringify(storedValue));
     } catch (error) {
       console.error(error);
     }
   }, [key, storedValue]);

   return [storedValue, setStoredValue];
 }

 // Usage in multiple components
 function ThemeToggle() {
   const [theme, setTheme] = useLocalStorage('theme', 'light');
   return (
     <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
       Current: {theme}
     </button>
   );
 }

 function FontSizeSelector() {
   const [fontSize, setFontSize] = useLocalStorage('fontSize', 16);
   return (
     <input 
       type="range" 
       value={fontSize} 
       onChange={(e) => setFontSize(Number(e.target.value))} 
     />
   );
 }
 ```

 Both components use `useLocalStorage`, but each has **its own independent state** that persists to localStorage.

### What is the useDebugValue hook?
The `useDebugValue` hook is used to **display a label** for custom hooks in **React DevTools**. It helps developers debug custom hooks by showing meaningful information.

 #### Syntax
 ```js
 useDebugValue(value);
 useDebugValue(value, formatFn); // With optional formatter
 ```

 #### Example: Custom Hook with Debug Value
 ```jsx
 import { useState, useEffect, useDebugValue } from 'react';

 function useOnlineStatus() {
   const [isOnline, setIsOnline] = useState(true);

   useEffect(() => {
     const handleOnline = () => setIsOnline(true);
     const handleOffline = () => setIsOnline(false);
     
     window.addEventListener('online', handleOnline);
     window.addEventListener('offline', handleOffline);
     
     return () => {
       window.removeEventListener('online', handleOnline);
       window.removeEventListener('offline', handleOffline);
     };
   }, []);

   // Shows "OnlineStatus: Online" or "OnlineStatus: Offline" in DevTools
   useDebugValue(isOnline ? 'Online' : 'Offline');

   return isOnline;
 }
 ```

 #### With Formatting Function (for expensive computations)
 ```jsx
 function useUser(userId) {
   const [user, setUser] = useState(null);
   
   // The format function only runs when DevTools is open
   useDebugValue(user, (user) => user ? `User: ${user.name}` : 'Loading...');
   
   return user;
 }
 ```

 **Note:** Only use `useDebugValue` in custom hooks that are part of shared libraries. It's not necessary for every custom hook in application code.

### How do you handle cleanup in useEffect?
The cleanup function in `useEffect` is used to **clean up side effects** before the component unmounts or before the effect runs again. This prevents memory leaks, stale data, and unexpected behavior.

 #### Syntax
 ```js
 useEffect(() => {
   // Setup code
   
   return () => {
     // Cleanup code
   };
 }, [dependencies]);
 ```

 #### Common Cleanup Scenarios

 **1. Event Listeners**
 ```jsx
 useEffect(() => {
   const handleResize = () => setWidth(window.innerWidth);
   window.addEventListener('resize', handleResize);
   
   return () => window.removeEventListener('resize', handleResize);
 }, []);
 ```

 **2. Timers and Intervals**
 ```jsx
 useEffect(() => {
   const intervalId = setInterval(() => {
     setCount(c => c + 1);
   }, 1000);
   
   return () => clearInterval(intervalId);
 }, []);
 ```

 **3. Subscriptions**
 ```jsx
 useEffect(() => {
   const subscription = dataSource.subscribe(handleChange);
   
   return () => subscription.unsubscribe();
 }, [dataSource]);
 ```

 **4. Abort Fetch Requests**
 ```jsx
 useEffect(() => {
   const controller = new AbortController();
   
   fetch(url, { signal: controller.signal })
     .then(response => response.json())
     .then(data => setData(data))
     .catch(err => {
       if (err.name !== 'AbortError') {
         setError(err);
       }
     });
   
   return () => controller.abort();
 }, [url]);
 ```

 **When Cleanup Runs:**
 - Before the component unmounts
 - Before re-running the effect when dependencies change

### What are the best practices for using React Hooks?
Following best practices ensures your hooks are predictable, maintainable, and bug-free.

 #### 1. **Follow the Rules of Hooks**
 - Only call hooks at the top level (not inside loops, conditions, or nested functions)
 - Only call hooks from React functions (components or custom hooks)

 #### 2. **Use the ESLint Plugin**
 ```bash
 npm install eslint-plugin-react-hooks --save-dev
 ```
 ```json
 {
   "plugins": ["react-hooks"],
   "rules": {
     "react-hooks/rules-of-hooks": "error",
     "react-hooks/exhaustive-deps": "warn"
   }
 }
 ```

 #### 3. **Keep Hooks Focused and Simple**
 ```jsx
 // ❌ Bad: One hook doing too much
 function useEverything() {
   const [user, setUser] = useState(null);
   const [posts, setPosts] = useState([]);
   const [theme, setTheme] = useState('light');
   // ... lots of unrelated logic
 }

 // ✅ Good: Separate concerns
 function useUser() { /* user logic */ }
 function usePosts() { /* posts logic */ }
 function useTheme() { /* theme logic */ }
 ```

 #### 4. **Use Descriptive Names for Custom Hooks**
 ```jsx
 // ❌ Bad
 function useData() { }

 // ✅ Good
 function useUserAuthentication() { }
 function useFetchProducts() { }
 function useFormValidation() { }
 ```

 #### 5. **Properly Manage Dependencies**
 ```jsx
 // ❌ Bad: Missing dependency
 useEffect(() => {
   fetchUser(userId);
 }, []); // userId is missing

 // ✅ Good: All dependencies listed
 useEffect(() => {
   fetchUser(userId);
 }, [userId]);
 ```

 #### 6. **Avoid Inline Object/Function Dependencies**
 ```jsx
 // ❌ Bad: New object on every render
 useEffect(() => {
   doSomething(options);
 }, [{ page: 1, limit: 10 }]); // Always different reference

 // ✅ Good: Memoize or extract
 const options = useMemo(() => ({ page: 1, limit: 10 }), []);
 useEffect(() => {
   doSomething(options);
 }, [options]);
 ```

 #### 7. **Clean Up Side Effects**
 Always return a cleanup function when subscribing to events, timers, or external data sources.

### What is the use of refs?
The _ref_ is used to return a reference to the element. They _should be avoided_ in most cases, however, they can be useful when you need a direct access to the DOM element or an instance of a component.

### What are forward refs?
_Ref forwarding_ is a feature that lets some components take a _ref_ they receive, and pass it further down to a child.

   ```jsx harmony
   const ButtonElement = React.forwardRef((props, ref) => (
 <button ref={ref} className="CustomButton">
   {props.children}
 </button>
   ));

   // Create ref to the DOM button:
   const ref = React.createRef();
   <ButtonElement ref={ref}>{"Forward Ref"}</ButtonElement>;
   ```

### Why are String Refs legacy?
If you worked with React before, you might be familiar with an older API where the `ref` attribute is a string, like `ref={'textInput'}`, and the DOM node is accessed as `this.refs.textInput`. We advise against it because _string refs have below issues_, and are considered legacy. String refs were **removed in React v16**.

   1. They _force React to keep track of currently executing component_. This is problematic because it makes react module stateful, and thus causes weird errors when react module is duplicated in the bundle.
   2. They are _not composable_, if a library puts a ref on the passed child, the user can't put another ref on it. Callback refs are perfectly composable.
   3. They _don't work with static analysis_ like Flow. Flow can't guess the magic that framework does to make the string ref appear on `this.refs`, as well as its type (which could be different). Callback refs are friendlier to static analysis.
   4. It doesn't work as most people would expect with the "render callback" pattern (e.g. <DataGrid renderRow={this.renderRow} />)

  ```jsx harmony
  class MyComponent extends Component {
    renderRow = (index) => {
      // This won't work. Ref will get attached to DataTable rather than MyComponent:
      return <input ref={"input-" + index} />;

      // This would work though! Callback refs are awesome.
      return <input ref={(input) => (this["input-" + index] = input)} />;
    };

    render() {
      return (
        <DataTable data={this.props.data} renderRow={this.renderRow} />
      );
    }
  }
  ```

### What is context?
_Context_ provides a way to pass data through the component tree without having to pass props down manually at every level.

For example, authenticated users, locale preferences, UI themes need to be accessed in the application by many components.

```javascript
const { Provider, Consumer } = React.createContext(defaultValue);
```

### What are error boundaries in React v16?
_Error boundaries_ are components that catch JavaScript errors anywhere in their child component tree, log those errors, and display a fallback UI instead of the component tree that crashed.

A class component becomes an error boundary if it defines a new lifecycle method called `componentDidCatch(error, info)` or `static getDerivedStateFromError() `:

```jsx harmony
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error, info) {
    // You can also log the error to an error reporting service
    logErrorToMyService(error, info);
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <h1>{"Something went wrong."}</h1>;
    }
    return this.props.children;
  }
}
```

After that use it as a regular component:

```jsx harmony
<ErrorBoundary>
  <MyWidget />
</ErrorBoundary>
```

### Why is `isMounted()` an anti-pattern and what is the proper solution?
The primary use case for `isMounted()` is to avoid calling `setState()` after a component has been unmounted, because it will emit a warning.

```javascript
if (this.isMounted()) {
  this.setState({...})
}
```

Checking `isMounted()` before calling `setState()` does eliminate the warning, but it also defeats the purpose of the warning. Using `isMounted()` is a code smell because the only reason you would check is because you think you might be holding a reference after the component has unmounted.

An optimal solution would be to find places where `setState()` might be called after a component has unmounted, and fix them. Such situations most commonly occur due to callbacks, when a component is waiting for some data and gets unmounted before the data arrives. Ideally, any callbacks should be canceled in `componentWillUnmount()`, prior to unmounting.

### Why is a component constructor called only once?
React's _reconciliation_ algorithm assumes that without any information to the contrary, if a custom component appears in the same place on subsequent renders, it's the same component as before, so reuses the previous instance rather than creating a new one.

### What are render props?
**Render Props** is a simple technique for sharing code between components using a prop whose value is a function. The below component uses render prop which returns a React element.

```jsx harmony
<DataProvider render={(data) => <h1>{`Hello ${data.target}`}</h1>} />
```

Libraries such as React Router and DownShift are using this pattern.

### Why are inline ref callbacks or functions not recommended?
If the ref callback is defined as an inline function, it will get called twice during updates, first with null and then again with the DOM element. This is because a new instance of the function is created with each render, so React needs to clear the old ref and set up the new one.

```jsx
class UserForm extends Component {
  handleSubmit = () => {
    console.log("Input Value is: ", this.input.value);
  };

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <input type="text" ref={(input) => (this.input = input)} /> //
        Access DOM input in handle submit
        <button type="submit">Submit</button>
      </form>
    );
  }
}
```

But our expectation is for the ref callback to get called once, when the component mounts. One quick fix is to use the ES7 class property syntax to define the function

```jsx
class UserForm extends Component {
  handleSubmit = () => {
    console.log("Input Value is: ", this.input.value);
  };

  setSearchInput = (input) => {
    this.input = input;
  };

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <input type="text" ref={this.setSearchInput} /> // Access DOM input
        in handle submit
        <button type="submit">Submit</button>
      </form>
    );
  }
}
```

### What is the difference between try catch block and error boundaries?
Try catch block works with imperative code whereas error boundaries are meant for declarative code to render on the screen.

For example, the try catch block used for below imperative code

```javascript
try {
  showButton();
} catch (error) {
  // ...
}
```

Whereas error boundaries wrap declarative code as below,

```javascript
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

So if an error occurs in a **componentDidUpdate** method caused by a **setState** somewhere deep in the tree, it will still correctly propagate to the closest error boundary.

### How to debug forwardRefs in DevTools?
**React.forwardRef** accepts a render function as parameter and DevTools uses this function to determine what to display for the ref forwarding component.

For example, If you don't name the render function or not using displayName property then it will appear as ”ForwardRef” in the DevTools,

```javascript
const WrappedComponent = React.forwardRef((props, ref) => {
  return <LogProps {...props} forwardedRef={ref} />;
});
```

But If you name the render function then it will appear as **”ForwardRef(myFunction)”**

```javascript
const WrappedComponent = React.forwardRef(function myFunction(props, ref) {
  return <LogProps {...props} forwardedRef={ref} />;
});
```

As an alternative, You can also set displayName property for forwardRef function,

```javascript
function logProps(Component) {
  class LogProps extends React.Component {
    // ...
  }

  function forwardRef(props, ref) {
    return <LogProps {...props} forwardedRef={ref} />;
  }

  // Give this component a more helpful display name in DevTools.
  // e.g. "ForwardRef(logProps(MyComponent))"
  const name = Component.displayName || Component.name;
  forwardRef.displayName = `logProps(${name})`;

  return React.forwardRef(forwardRef);
}
```

### How do you say that state updates are merged?
When you call setState() in the component, React merges the object you provide into the current state.

For example, let us take a facebook user with posts and comments details as state variables,

```javascript
  constructor(props) {
    super(props);
    this.state = {
      posts: [],
      comments: []
    };
  }
```

Now you can update them independently with separate `setState()` calls as below,

```javascript
 componentDidMount() {
    fetchPosts().then(response => {
      this.setState({
        posts: response.posts
      });
    });

    fetchComments().then(response => {
      this.setState({
        comments: response.comments
      });
    });
  }
```

As mentioned in the above code snippets, `this.setState({comments})` updates only comments variable without modifying or replacing `posts` variable.

### How do you pass arguments to an event handler?
During iterations or loops, it is common to pass an extra parameter to an event handler. This can be achieved through arrow functions or bind method.

Let us take an example of user details updated in a grid,

```javascript
<button onClick={(e) => this.updateUser(userId, e)}>Update User details</button>
<button onClick={this.updateUser.bind(this, userId)}>Update User details</button>
```

In the both approaches, the synthetic argument `e` is passed as a second argument. You need to pass it explicitly for arrow functions and it will be passed automatically for `bind` method.

### How to prevent component from rendering?
You can prevent component from rendering by returning null based on specific condition. This way it can conditionally render component.

```javascript
function Greeting(props) {
  if (!props.loggedIn) {
    return null;
  }

  return <div className="greeting">welcome, {props.name}</div>;
}
```

```javascript
class User extends React.Component {
  constructor(props) {
    super(props);
    this.state = {loggedIn: false, name: 'John'};
  }

  render() {
   return (
       <div>
         //Prevent component render if it is not loggedIn
         <Greeting loggedIn={this.state.loggedIn} />
         <UserDetails name={this.state.name}>
       </div>
   );
  }
```

In the above example, the `greeting` component skips its rendering section by applying condition and returning null value.

### How do you use contextType?
ContextType is used to consume the context object. The contextType property can be used in two ways,

1.  **contextType as property of class:**
    The contextType property on a class can be assigned a Context object created by React.createContext(). After that, you can consume the nearest current value of that Context type using this.context in any of the lifecycle methods and render function.

    Lets assign contextType property on MyClass as below,

    ```javascript
    class MyClass extends React.Component {
      componentDidMount() {
        let value = this.context;
        /* perform a side-effect at mount using the value of MyContext */
      }
      componentDidUpdate() {
        let value = this.context;
        /* ... */
      }
      componentWillUnmount() {
        let value = this.context;
        /* ... */
      }
      render() {
        let value = this.context;
        /* render something based on the value of MyContext */
      }
    }
    MyClass.contextType = MyContext;
    ```

2.  **Static field**
    You can use a static class field to initialize your contextType using public class field syntax.

    ```javascript
    class MyClass extends React.Component {
      static contextType = MyContext;
      render() {
        let value = this.context;
        /* render something based on the value */
      }
    }
    ```

### How do you solve performance corner cases while using context?
The context uses reference identity to determine when to re-render, there are some gotchas that could trigger unintentional renders in consumers when a provider’s parent re-renders.

For example, the code below will re-render all consumers every time the Provider re-renders because a new object is always created for value.

```javascript
class App extends React.Component {
  render() {
    return (
      <Provider value={{ something: "something" }}>
        <Toolbar />
      </Provider>
    );
  }
}
```

This can be solved by lifting up the value to parent state,

```javascript
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: { something: "something" },
    };
  }

  render() {
    return (
      <Provider value={this.state.value}>
        <Toolbar />
      </Provider>
    );
  }
}
```

### What is the purpose of forward ref in HOCs?
Refs will not get passed through because ref is not a prop. It is handled differently by React just like **key**. If you add a ref to a HOC, the ref will refer to the outermost container component, not the wrapped component. In this case, you can use Forward Ref API. For example, we can explicitly forward refs to the inner FancyButton component using the React.forwardRef API.

The below HOC logs all props,

```javascript
function logProps(Component) {
  class LogProps extends React.Component {
    componentDidUpdate(prevProps) {
      console.log("old props:", prevProps);
      console.log("new props:", this.props);
    }

    render() {
      const { forwardedRef, ...rest } = this.props;

      // Assign the custom prop "forwardedRef" as a ref
      return <Component ref={forwardedRef} {...rest} />;
    }
  }

  return React.forwardRef((props, ref) => {
    return <LogProps {...props} forwardedRef={ref} />;
  });
}
```

Let's use this HOC to log all props that get passed to our “fancy button” component,

```javascript
class FancyButton extends React.Component {
  focus() {
    // ...
  }

  // ...
}
export default logProps(FancyButton);
```

Now let's create a ref and pass it to FancyButton component. In this case, you can set focus to button element.

```javascript
import FancyButton from "./FancyButton";

const ref = React.createRef();
ref.current.focus();
<FancyButton label="Click Me" handleClick={handleClick} ref={ref} />;
```

### How do you create HOC using render props?
You can implement most higher-order components (HOC) using a regular component with a render prop. For example, if you would prefer to have a withMouse HOC instead of a <Mouse> component, you could easily create one using a regular <Mouse> with a render prop.

```javascript
function withMouse(Component) {
  return class extends React.Component {
    render() {
      return (
        <Mouse
          render={(mouse) => <Component {...this.props} mouse={mouse} />}
        />
      );
    }
  };
}
```

This way render props gives the flexibility of using either pattern.

### How do you get redux scaffolding using create-react-app?
Redux team has provided official redux+js or redux+typescript templates for create-react-app project. The generated project setup includes,
1.  Redux Toolkit and React-Redux dependencies
2.  Create and configure Redux store
3.  React-Redux `<Provider>` passing the store to React components
4.  Small "counter" example to demo how to add redux logic and React-Redux hooks API to interact with the store from components
    The below commands need to be executed along with template option as below,
5.  **Javascript template:**
```js
npx create-react-app my-app --template redux
```
2.  **Typescript template:**
```js
npx create-react-app my-app --template redux-typescript
```
