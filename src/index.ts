import { ChatCompletionRequestMessage } from "openai"
import { Message, Whatsapp, create } from "venom-bot"

import { openai } from "./lib/openai"
import { redis } from "./lib/redis"

import { initPrompt } from "./utils/initPrompt"


interface CustomerChat {
  status?: "open" | "closed"
  orderCode: string
  chatAt: string
  customer: {
    name: string
    phone: string
  }
  messages: ChatCompletionRequestMessage[]
  orderSummary?: string
};

async function completion(
  messages: ChatCompletionRequestMessage[]
): Promise<string | undefined> {
    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            temperature: 0,
            max_tokens: 256,
            messages,
        });
        
        return completion.data.choices[0].message?.content;
    } catch(error) {
        console.log(error);
        return 'Desculpa, não entendi. Pode repetir novamente?';
    }
};

create({
  session: "food-gpt",
  disableWelcome: true,
})
  .then(async (client: Whatsapp) => await start(client))
  .catch((err) => {
    console.log(err)
  });


async function start(client: Whatsapp) {
  const storeName = "Pizzaria Los Italianos";
 
  try {
    client.onMessage(async (message: Message) => {
        if (!message.body || message.isGroupMsg) return;
        if (message.type !== 'chat') return;
        
        const customerPhone = `+${message.from.replace("@c.us", "")}`;
        const customerName = message.author;
        const customerKey = `customer:${customerPhone}:chat`;
        const orderCode = `#sk-${("00000" + Math.random()).slice(-5)}`;
    
        const lastChat = JSON.parse((await redis.get(customerKey)) || "{}");
    
        const customerChat: CustomerChat =
          lastChat?.status === "open"
            ? (lastChat as CustomerChat)
            : {
                status: "open",
                orderCode,
                chatAt: new Date().toISOString(),
                customer: {
                  name: customerName,
                  phone: customerPhone,
                },
                messages: [
                  {
                    role: "system",
                    content: initPrompt(storeName, orderCode),
                  },
                ],
                orderSummary: "",
              };
    
        console.debug(customerPhone, "👤", message.body);
    
        customerChat.messages.push({
          role: "user",
          content: message.body,
        });
    
        const content = (await completion(customerChat.messages)) || "Não entendi...";
    
        customerChat.messages.push({
          role: "assistant",
          content,
        });
    
        console.debug(customerPhone, "🤖", content);
    
        await client.sendText(message.from, content);
    
        if (
          customerChat.status === "open" &&
          content.match(customerChat.orderCode)
        ) {
          customerChat.status = "closed";
    
          customerChat.messages.push({
            role: "user",
            content:
              "Gere um resumo de pedido para registro no sistema da pizzaria, quem está solicitando é um robô.",
          });
    
          const content = (await completion(customerChat.messages)) || "Não entendi...";
    
          console.debug(customerPhone, "📦", content);
    
          customerChat.orderSummary = content;
        }
    
        redis.set(customerKey, JSON.stringify(customerChat));
      });
    } catch(error) {
        console.log(error);
    }
}








// interface CustomerChat2 {
//   chatAt: string
//   customer: {
//     name: string
//     phone: string
//   }
//   messages: ChatCompletionRequestMessage[]
// };


// async function start2(client: Whatsapp) { 
//   try {
//     client.onMessage(async (message: Message) => {
//         if (!message.body || message.isGroupMsg) return;
//         if (message.type !== 'chat') return;

//         const customerName = message.chatId;
//         const customerPhone = `+${message.from.replace("@c.us", "")}`;
//         const customerKey = `customer:${customerPhone}:chat`;
    
//         const lastChat: CustomerChat2 = JSON.parse((await redis.get(customerKey)) || "{}");
    
//         const customerChat: CustomerChat2 =
//           lastChat?.customer?.name === customerName
//             ? (lastChat as CustomerChat2)
//             : {
//                 chatAt: new Date().toISOString(),
//                 customer: {
//                   name: customerName,
//                   phone: customerPhone,
//                 },
//                 messages: [
//                   {
//                     role: "system",
//                     content: 'Meu nome é Matheus e meu email é matheusfdc10@gmail.com. Você é minha assistente virtual e irá atender as pessaos que entrarem em contato comigo. Você deve ser educada, atenciosa, amigável, cordial e muito paciente.',
//                   },
//                 ],
//               };
//     start
//         console.debug(customerPhone, "👤", message.body);
    
//         customerChat.messages.push({
//           role: "user",
//           content: message.body,
//         });
    
//         const content = (await completion(customerChat.messages)) || "Não entendi...";
    
//         customerChat.messages.push({
//           role: "assistant",
//           content,
//         });
    
//         console.debug(customerPhone, "🤖", content);
    
//         await client.sendText(message.from, content);
    
//         redis.set(customerKey, JSON.stringify(customerChat));
//       });
//     } catch(error) {
//         console.log(error);
//     }
// }