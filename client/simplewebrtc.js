class SimpleWebRTC {
    constructor() {
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
            ]
        }
        this.peerConnections = new Map();
        this.dataChannels = new Map();
    }

    async createOffer(remoteUserId) {
        const peerConnection = this.createPeerConnection(remoteUserId);
        const dataChannel = this.createDataChannel(peerConnection, remoteUserId);

        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            return { offer, dataChannel };
        } catch (error) {
            console.error(`Error creating offer for ${remoteUserId}: ${error}`);
            return null;
        }
    }

    async createAnswer(remoteUserId, offer) {
        const peerConnection = this.createPeerConnection(remoteUserId);
        const dataChannel = this.createDataChannel(peerConnection, remoteUserId);

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            return { answer, dataChannel };
        } catch (error) {
            console.error(`Error creating answer for ${remoteUserId}: ${error}`);
            return null;
        }
    }

    async handleAnswer(remoteUserId, answer) {
        const peerConnection = this.peerConnections.get(remoteUserId);

        if (peerConnection) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                console.error(`Error handling answer for ${remoteUserId}: ${error}`);
            }
        } else {
            console.error(`Peer connection not found for ${remoteUserId}`);
        }
    }

    getLocalOffer(remoteUserId) {
        const peerConnection = this.peerConnections.get(remoteUserId);

        if (peerConnection) {
            return peerConnection.localDescription;
        } else {
            console.error(`Peer connection not found for ${remoteUserId}`);
            return null;
        }
    }

    async handleRemoteOffer(remoteUserId, offer) {
        const peerConnection = this.createPeerConnection(remoteUserId);
        const dataChannel = this.createDataChannel(peerConnection, remoteUserId);

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            return { answer, dataChannel };
        } catch (error) {
            console.error(`Error handling remote offer for ${remoteUserId}: ${error}`);
            return null;
        }
    }

    addIceCandidate(remoteUserId, iceCandidate) {
        const peerConnection = this.peerConnections.get(remoteUserId);

        if (peerConnection) {
            try {
                const candidate = new RTCIceCandidate(iceCandidate);
                peerConnection.addIceCandidate(candidate);
            } catch (error) {
                console.error(`Error adding ice candidate for ${remoteUserId}: ${error}`);
            }
        } else {
            console.error(`Peer connection not found for ${remoteUserId}`);
        }
    }

    createPeerConnection(remoteUserId) {
        const peerConnection = new RTCPeerConnection(this.configuration);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Send the ICE candidate to the remote peer using your signaling mechanism
                console.log(event.candidate);
            }
        };

        peerConnection.ondatachannel = (event) => {
            const dataChannel = event.channel;
            this.handleDataChannel(dataChannel, remoteUserId);
        };

        this.peerConnections.set(remoteUserId, peerConnection);

        return peerConnection;
    }

    handleDataChannel(dataChannel, remoteUserId) {
        if (!this.dataChannels.has(remoteUserId)) {
            const defaultDataChannel = dataChannel;
            this.dataChannels.set(remoteUserId, defaultDataChannel);

            defaultDataChannel.onmessage = (event) => {
                console.log(`Received message from ${remoteUserId}: ${event.data}`);
            };

            defaultDataChannel.onopen = () => {
                console.log(`Data channel with ${remoteUserId} opened`);
            };

            defaultDataChannel.onclose = () => {
                console.log(`Data channel with ${remoteUserId} closed`);
            };
        }
    }

    createDataChannel(peerConnection, remoteUserId) {
        const dataChannel = peerConnection.createDataChannel(
            'default',
            { negotiated: true, id: 0, ordered: true, protocol: 'clomega' }
        );
        this.handleDataChannel(dataChannel, remoteUserId);
        return dataChannel;
    }
}

// Example usage:
// const conn = new SimpleWebRTC();

// Host Mode
// const { offer, dataChannel } = await conn.createOffer("remoteUser1");
// // Send the offer to the remote user using your signaling mechanism
// // ...

// Peer Mode
// // Receive the remote offer using your signaling mechanism
// const remoteOffer = // ...;
// const { answer, dataChannel } = await conn.createAnswer("hostUser", remoteOffer);
// // Send the answer to the host user using your signaling mechanism
// // ...

// Both
// // Handle incoming ICE candidates
// conn.addIceCandidate("(user)", iceCandidate);
// ...