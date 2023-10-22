// Name: CloudLink Ω
// ID: cloudlinkomega
// Description: The most powerful multiplayer engine.
// By: MikeDEV

/* eslint-disable */
// prettier-ignore

(function (vm) {
	/*
	CloudLink Omega Client for Turbowarp v0.1.0

	CLΩ is NOT compatible with normal CL. It is intended for use with a
	CL Omega server.

	MIT License

	Copyright (c) 2023 Mike J. Renaker / "MikeDEV

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/

	var clVars = {
		isSTUNReachable: false,
		isTURNReachable: false,
		signalingServer: 'wss://i5-imac.local:3000/ws/foobar?v=1.0',
		iceServers: [
			{
				urls: "stun:stun.mikedev101.cc:3478",
			},
			{
				urls: "turn:stun.mikedev101.cc:3478",
				username: 'test',
				credential: 'test123'
			}
		],
		isHost: false,
		signaling: null,
		localCom: null,
		txChan: null,
		rxChan: null,
		ugi: "",
		myOffer: null,
		myAnswer: null,
		icePeers: [],
	}

	async function handleICE(pc, e, label) {
		if (!e.candidate) return;
		console.log(`${label}🧊🔍 Got ICE candidate: `, e.candidate);
		
		// Check for responses from STUN
		if (e.candidate.type == 'srflx' || e.candidate.candidate.includes('srflx')) {
			let ip = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
			let address = e.candidate.address 
				? e.candidate.address 
				: e.candidate.candidate.match(ip);
			console.log('🟢 Public IP Address: ', address);
			console.log('🟢 STUN server is reachable!');
			clVars.isSTUNReachable = true;
		}

		// Check for responses from STUN
		if (e.candidate.type == 'relay' || e.candidate.candidate.includes('relay')) {
			console.log('🟢 TURN server is reachable!');
			clVars.isTURNReachable = true;
		}

		// Add the peer to our records
		if (!clVars.icePeers.includes(e.candidate)) {
			console.log('🧊✅ ICE candidate added: ', e.candidate);
			clVars.icePeers.push(e.candidate);
		}
	}

	async function sendData(opcode, data) {
		var message = {
			opcode: opcode,
			payload: data,
			ugi: clVars.ugi
		};
		clVars.signaling.send(JSON.stringify(message));
	}

	async function handleChannelEvents(com, label) {

		com.onnegotiationneeded = async(e) => {
			console.log(`${label}🗣️ negotiation needed: `, e)
			if (com.signalingState != "stable") return;
		};

		com.onicecandidateerror = async(e) => {
			console.error(`${label}🧊⚠️ ICE candidate error (${e.errorCode}): ${e.errorText}`, e);
		};

		com.oniceconnectionstatechange = async(e) => {
			console.log(`${label}🧊⌛ ICE connection state has changed: `, e);
		};

		com.onicegatheringstatechange = async(e) => {
			console.log(`${label}🧊⌛ ICE gathering state has changed: `, e);
		};
	}

	async function handleChannelStatusChange(chan, label) {

		chan.onmessage = (e) => {
			console.log(`${label}🟢 channel new data! `, e);
		}

		chan.onopen = (e) => {
			console.log(`${label}🟢 channel opened! `, e);
		}

		chan.onclose = (e) => {
			console.log(`${label}🔴 channel closed! `, e);
		}

		chan.onerror = (e) => {
			console.log(`${label}⚠️ channel error: `, e);
		}
	}

	async function handleSignalerEvent(message) {
		switch (message.opcode) {
			case "QUERY":
				if (!clVars.isHost) return;

				// Handle query request
				if (message.ugi != clVars.ugi) {
					console.log("Ignoring QUERY request from a different UGI.");
					return;
				};

				// Send ICE
				/*
				for (peer of clVars.icePeers) {
					console.log('🧊⬆️ Sending ICE peer: ', peer);
					sendData("ICE", peer);
				}*/

				// Send offer
				console.log('🟡⬆️ Sending offer: ', clVars.myOffer);
				await sendData("NEW_OFFER", clVars.myOffer);

				break;
			
			case "ICE":
				console.log('🟡⬇️ Got an ICE offer: ', message.payload);
				clVars.localCom.addIceCandidate(message.payload)
				.then(() => {
					console.log('🧊✅ ICE candidate added!');
				})
				.catch((error) => {
					console.error('🧊⚠️ Failed to add ICE candidate! ', error);
				});

			case "NEW_OFFER":
				if (clVars.isHost) return;
				console.log('🟡⬇️ Got an offer: ', message.payload);
				clVars.localCom.setRemoteDescription(
					new RTCSessionDescription(message.payload),
					async() => {
						// Create response
						clVars.myAnswer = await clVars.localCom.createAnswer();
						console.log('🟡⬆️ Created answer: ', clVars.myAnswer);
						sendData("ACK_OFFER", clVars.myAnswer);
					},
					async(error) => {
						console.log('⚠️ Failed to set remote RDP: ', error);
					}
				)
				
				break;
			
			case "ACK_OFFER":
				if (!clVars.isHost) return;
				console.log('🟡⬇️ Got an answer: ', message.payload);
				clVars.localCom.setRemoteDescription(
					new RTCSessionDescription(message.payload),
					() => {},
					async(error) => {
						console.log('⚠️ Failed to set remote RDP: ', error);
					}
				)
				break;
			
			case "GOODBYE":
				break;
		}
	}

	async function handleCreateDescriptionError(e) {
		return;
	}

	async function newRTC(isHost) {

		// Create new WebRTC objects
		clVars.localCom = new RTCPeerConnection({iceServers: clVars.iceServers});
		console.log('🔃 Initializing connection object: ', clVars.localCom);

		// Create initalizing TX data channel
		clVars.txChan = clVars.localCom.createDataChannel('txChan');
		console.log('🔃 Creating data channel: ', clVars.txChan);

		// Handle ICE events
		clVars.localCom.onicecandidate = async(e) => await handleICE(clVars.localCom, e, "");

		// Handle COM events
		handleChannelEvents(clVars.localCom, "");

		// Handle channel status changes
		handleChannelStatusChange(clVars.txChan, "");

		// Handle signal state changes
		clVars.localCom.signalingstatechange = (e) => {
			switch (e.signalingSate) {
				case "stable":
					console.log(`🟢 ICE negotiation complete `, e);
					break;
				case "have-local-offer":
					console.log(`🟢 Local offer generated and applied! `, e);
					break;
				case "have-remote-offer":
					console.log(`🟢 Remote offer received and applied! `, e);
					break;
				case "have-local-pranswer":
					console.log(`🟢 Local offer answered and applied! `, e);
					break;
				case "have-remote-pranswer":
					console.log(`🟢 Remote offer answered and applied! `, e);
					break;
			}
		}

		// Create offer
		if (isHost) {
			clVars.myOffer = await clVars.localCom.createOffer();
			console.log('🟡⬆️ Created offer: ', clVars.myOffer);
			clVars.localCom.setLocalDescription(clVars.myOffer)
			.then(async() => {

				// Send offer
				console.log('🟡⬆️ Sending offer: ', clVars.myOffer);
				await sendData("NEW_OFFER", clVars.myOffer);

			})
			.catch(handleCreateDescriptionError);
		}

		// Attempt connection
		else {
			clVars.myOffer = await clVars.localCom.createOffer();
			console.log('🟡⬆️ Set offer: ', clVars.myOffer);
			clVars.localCom.setLocalDescription(clVars.myOffer)

			// Send query
			console.log('🟡⬆️ Sending query');
			await sendData("QUERY", null);
			console.log('🟡⬇️ Waiting for offer to come through');
		}
	}

	async function initConnection(isHost) {
		clVars.isHost = isHost;

		// Connect to signaling server
		clVars.signaling = await new WebSocket(clVars.signalingServer);
		console.log('🔃📶🔌 Connecting to signaling backend: ', clVars.signaling);

		// Handle disconnect
		clVars.signaling.onclose = (e) => {
			console.log('🟥📶🔌 Disconnected from signaling backend: ', e);
		}

		// Handle signaling events
		clVars.signaling.onmessage = async(e) => {
			let resp;
			try {
				resp = JSON.parse(e.data);
			} catch (err) {
				console.warn('⚠️ JSON Parse error: ', err);
				return;
			}
			console.log('🟩📶💬 Got message from signaling backend: ', resp);
			handleSignalerEvent(resp);
		}

		// Handle signal backend connection (begin RTC lifespan)
		clVars.signaling.onopen = (e) => {
			console.log('🟩📶🔌 Connected to signaling backend: ', e);
			newRTC(isHost);
		}
	}

	class CloudLinkOmega {
		getInfo() {
			return {
				id: 'cloudlinkomega',
				name: 'CloudLink Ω',
				// docsURI: 'https://cloudlink.mikedev101.cc/omega/', # TODO: website
				// blockIconURI: cl_block,
				// menuIconURI: cl_icon,
				color1: "#ff4d4c",
				color2: "#ff6160",
				color3: "#ff7473",
				blocks: [
					{
						opcode: 'getSTUNConnectivity',
						blockType: 'reporter',
						text: 'Is STUN reachable?'
					},
					{
						opcode: 'getTURNConnectivity',
						blockType: 'reporter',
						text: 'Is TURN reachable?'
					},
					{
						opcode: 'initalizeHost',
						blockType: 'command',
						text: 'Host game [UGI]',
						arguments: {
							UGI: {
								type: 'string',
								defaultValue: 'demo',
							}
						}
					},
					{
						opcode: 'initalizePeer',
						blockType: 'command',
						text: 'Connect to game [UGI]',
						arguments: {
							UGI: {
								type: 'string',
								defaultValue: 'demo',
							}
						}
					},
					{
						opcode: 'sendSomething',
						blockType: 'command',
						text: 'Send data [DATA]',
						arguments: {
							DATA: {
								type: 'string',
								defaultValue: '',
							}
						}
					},
				]
			};
		}

		getSTUNConnectivity() {
			return clVars.isSTUNReachable;
		}
		
		getTURNConnectivity() {
			return clVars.isTURNReachable;
		}

		initalizeHost(args) {
			if (clVars.localCom != null) return;
			clVars.ugi = args.UGI;
			initConnection(true);
		}

		initalizePeer(args) {
			if (clVars.localCom != null) return;
			clVars.ugi = args.UGI;
			initConnection(false);
		}

		sendSomething(args) {
			if (clVars.localCom != null) return;
			clVars.localCom.send(args.DATA);
		}
	}
	vm.extensionManager._registerInternalExtension(new CloudLinkOmega());
})(vm);