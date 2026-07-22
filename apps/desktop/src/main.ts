import "./styles.css";
import { mount } from "svelte";
import App from "./App.svelte";

const root = document.getElementById("app");
let rendererMounted = false;

window.addEventListener("error", (event) => {
  if (rendererMounted) showRuntimeError(event.error ?? event.message);
  else showFatalError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  if (rendererMounted) showRuntimeError(event.reason);
  else showFatalError(event.reason);
});

if (!root) {
  throw new Error("Schematica could not find the app root element.");
}

const app = mount(App, { target: root });
rendererMounted = true;

export default app;

function showFatalError(error: unknown) {
  console.error("Schematica renderer fatal error", error);

  const target = document.getElementById("app");
  if (!target) return;

  const message =
    error instanceof Error
      ? [error.name, error.message, error.stack].filter(Boolean).join("\n\n")
      : String(error);
  target.innerHTML = "";
  target.append(Object.assign(document.createElement("div"), { className: "fatal-screen" }));
  const screen = target.querySelector(".fatal-screen");
  if (!screen) return;

  const title = document.createElement("h1");
  title.textContent = "Schematica could not start";
  const detail = document.createElement("p");
  detail.textContent = "The renderer hit a fatal error before the workbench could load.";
  const pre = document.createElement("pre");
  pre.textContent = message;
  screen.append(title, detail, pre);
}

function showRuntimeError(error: unknown) {
  console.error("Schematica renderer error", error);
  document.querySelector(".runtime-error-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "runtime-error-toast";
  toast.setAttribute("role", "alert");
  const message = document.createElement("span");
  message.textContent = error instanceof Error ? error.message : String(error);
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", () => toast.remove());
  toast.append(message, dismiss);
  document.body.append(toast);
}
