import { sequenceFromMermaid } from "../sequence-build";
import type { TemplateDefinition } from "../types";

/** Written as Mermaid, as people write sequences: frames (alt, opt, loop) and activation bars (+ / -) included. */
const CODE = `sequenceDiagram
  autonumber
  actor Customer
  participant WebShop as Web Shop
  participant Orders as Orders Service
  participant Gateway as Payment Gateway
  participant Notify as Notification Service
  Customer->>+WebShop: Place order
  WebShop->>+Orders: Create order (REST)
  Orders->>Orders: Check stock
  Orders->>+Gateway: Authorise payment (REST)
  Note over Orders,Gateway: Retries twice if the gateway times out
  alt Payment approved
    Gateway-->>-Orders: Payment authorised
    Orders-)Notify: OrderConfirmed (Kafka)
    Orders-->>WebShop: Order number
  else Payment declined
    Gateway-->>Orders: Declined
    Orders-->>WebShop: Payment failed
  end
  deactivate Orders
  WebShop-->>-Customer: Confirmation page
  opt Customer opted in to emails
    loop Until delivered, up to 3 times
      Notify-)Customer: Confirmation email (SMTP)
    end
  end
`;

export const sequenceTemplate: TemplateDefinition = {
  id: "sequence",
  name: "Sequence diagram",
  description:
    "A checkout flow step by step: who calls whom, in what order, sync or async, with alt/opt/loop frames and activation bars. Pair it with an L0 tab to explain how the architecture is used.",
  category: "Sequence",
  keywords: ["checkout", "messages", "participants"],
  build: () =>
    sequenceFromMermaid("Checkout flow", "Checkout", CODE, {
      "Web Shop": "product",
      "Orders Service": "microservice",
      "Payment Gateway": "third-party",
      "Notification Service": "microservice",
    }),
};
