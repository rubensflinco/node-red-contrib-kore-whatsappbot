const {existsSync, readFileSync} = require("fs");
module.exports = function (RED) {
    'use strict'
    const {writeFileSync} = require("fs");

    function WhatsappSendMessage (config) {
        RED.nodes.createNode(this, config)


        const node = this
        node.name = config.name
        node.force = config.force;
        node.message = config.template;
        node.typing = config.typing;
        node.sendRead = config.sendRead;


        const clientNode = RED.nodes.getNode(config.client);

        function simulateTyping(id,message){
            return new Promise((resolve)=> {
                clientNode.sendPresence(id,'composing');

                setTimeout(resolve,message.length*30);
            });
        }

        function saveState(id,data){
            const sessionDir = "/data/sessions/"+clientNode.id+"-"+id+".json";

            if(data){
                return writeFileSync(sessionDir,JSON.stringify(data));
            }else{
                return false;
            }
        }


        if (clientNode) {
            console.log(clientNode);
        }
        
        node.on('messageStatus', async function(msg){
            node.send([msg,null]);
        });

        node.on('input', async function (msg) {
            const to = msg.to || msg.payload.contactId;
            let message = msg.message || msg.payload.message || node.message;

            if(msg.executed){
                if(!msg.session){
                    msg.session = {};
                }

                msg.session['lastNodeId'] = node.id;
                saveState(to.split("@")[0],msg.session);

            }

            if(node.force || (msg.session===false && !msg.executed) || (msg.session && msg.session.lastNodeId === node.id && !msg.executed)) {

                if(msg.payload.contactId && msg.payload.messageId) {
                    clientNode.sendRead(msg.payload.contactId,msg.payload.participant,msg.payload.messageId)
                }

                if (to && message) {

                    if(!msg.session){
                        msg.session = {};
                    }

                    msg.executed = true;

                    Object.keys(msg.session).forEach((p)=>{

                        const kk = p.split("user.");


                        if(kk.length===2){
                            message = message.replace('{{'+kk[1]+'}}',msg.session[p]);
                        }
                    })

                    if(node.typing){
                        await simulateTyping(to,message);
                    }

                    clientNode.sendmessage(to, message,node.id);
                    //clientNode.sendTTS(to, message);


                    node.send([null,msg]);
                } else {
                    node.error('"to" and "message" are required parameters');
                }
            }else{
                node.send([null,msg]);
            }

        })



    }

    RED.nodes.registerType('whatsapp-sendmessage', WhatsappSendMessage)
}