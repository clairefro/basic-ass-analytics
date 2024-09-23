# Usage - Client snippet (React)

## Hook 
```ts
import { useEffect } from "react";

const useAn = () => {
  useEffect(() => {
    const send = async () => {
      const anUrl = import.meta.env.VITE_AN_URL;

      if (!anUrl) return;

      try {
        const timestamp = new Date().toISOString();
        const userAgent = navigator.userAgent;

        const response = await fetch(anUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timestamp,
            userAgent,
          }),
        });

        if (!response.ok) {
          console.error("Error sending data:", response.statusText);
        }
      } catch (error) {
        console.error("Error sending data:", error);
      }
    };

    send();
  }, []); 
};

export default useAn;
```

## Impl
Place at app root f only want hits on first render 
If page-wise analytics need, modify the server to collect page path, move impl to page layout 

```jsx
function App() {
  useAn();

  return (
    ...
  );
}

export default App;
```
