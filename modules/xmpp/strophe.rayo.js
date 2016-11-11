/* global $, $iq, Strophe */

import { getLogger } from "jitsi-meet-logger";
const logger = getLogger(__filename);
import ConnectionPlugin from "./ConnectionPlugin";

const RAYO_XMLNS = 'urn:xmpp:rayo:1';

class RayoConnectionPlugin extends ConnectionPlugin {
    init (connection) {
        super.init(connection);
        const disco = this.connection.disco;
        if (disco) {
            disco.addFeature('urn:xmpp:rayo:client:1');
        }

        this.connection.addHandler(
            this.onRayo.bind(this), RAYO_XMLNS, 'iq', 'set', null, null);
    }

    onRayo (iq) {
        logger.info("Rayo IQ", iq);
    }

    dial (to, from, roomName, roomPass, focusMucJid, nickName) {
        return new Promise((resolve, reject) => {
            if(!focusMucJid) {
                reject(new Error("Internal error!"));
                return;
            }
            const req = $iq({
                type: 'set',
                to: focusMucJid
            });
            req.c('dial', {
                xmlns: RAYO_XMLNS,
                to: to,
                from: from
            });
            req.c('header', {
                name: 'JvbRoomName',
                value: roomName
            }).up();

            if (roomPass && roomPass.length) {
                req.c('header', {
                    name: 'JvbRoomPassword',
                    value: roomPass
                }).up();
            }
            if (nickName && nickName.length) {
                req.c('header', {
                    name: 'Nickname',
                    value: nickName
                }).up();
            }

            this.connection.sendIQ(req, (result) => {
                logger.info('Dial result ', result);

                let resource = $(result).find('ref').attr('uri');
                this.call_resource =
                    resource.substr('xmpp:'.length);
                logger.info("Received call resource: " + this.call_resource);
                resolve(this.call_resource);
            }, (error) => {
                logger.info('Dial error ', error);
                reject(error);
            });
        });
    }

    hangup () {
        return new Promise((resolve, reject) => {
            if (!this.call_resource) {
                reject(new Error("No call in progress"));
                logger.warn("No call in progress");
                return;
            }

            const req = $iq({
                type: 'set',
                to: this.call_resource
            });
            req.c('hangup', {
                xmlns: RAYO_XMLNS
            });

            this.connection.sendIQ(req, (result) => {
                logger.info('Hangup result ', result);
                this.call_resource = null;
                resolve();
            }, (error) => {
                logger.info('Hangup error ', error);
                this.call_resource = null;
                reject(new Error('Hangup error '));
            });
        }.bind(this));
    }
}

export default function() {
    Strophe.addConnectionPlugin('rayo', new RayoConnectionPlugin());
}
