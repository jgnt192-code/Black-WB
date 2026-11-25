
export async function react(message, client, emoji = "🥷🏽") {

    const remoteJid = message.key.remoteJid;

   await client.sendMessage(remoteJid, 

        {
            react: {
                text: emoji,

                key: message.key
            }
        }

    )

}


export default react;
