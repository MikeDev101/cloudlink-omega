const server = "https://connect.inboxgo.org/inbox";

async function SignalReceive(username, password) {
  const headers = new Headers({
    Authorization: 'Basic ' + window.btoa(username + ":" + password)
  });

  const response = await fetch(server, {
    method: 'GET',
    cache: 'no-cache',
    headers: headers
  });

  try {
    var data = await response.json();
    const from = response.headers.get("X-From");
    console.log('Received', data);
    return {from: from, data: data};
  } catch(e) {
    return null;
  }
}


async function SignalSend(username, password, to, message) {
  console.log('Sending', message);

  const headers = new Headers({
    Authorization: 'Basic ' + window.btoa(username + ":" + password)
  });

  const response = await fetch(`${server}?to=${to}`, {
    method: 'POST',
    cache: 'no-cache',
    headers: headers,
    body: JSON.stringify(message)
  });
}

var peer;

async function CreateUser() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  let to = document.getElementById("to").value;
  let poll = true;
  document.getElementById("userform").style.display = "none";


  peer = new SimplePeer({ initiator: (to.length > 0) })

  peer.on('signal', data => {
    if ( to.length > 0 ) SignalSend(username, password, to, data);
  })

  peer.on('connect', () => {
    poll = false;
    peer.send('Hello ' + to);
  });

  peer.on('data', data => {
    var p = document.createElement("p");
    p.innerText = data;
    document.getElementById("log").appendChild(p);
  });

  peer.on('error', err => console.log('error', err));

  while ( poll ) {
    try {
      let message = await SignalReceive(username, password);
      to = message.from;
      peer.signal(message.data);
    } catch (e) {
      console.log("didn't receive a message or an error, retrying...", e);
    }
  }
}

function sendMessage() {
  const message = document.getElementById("message").value;
  peer.send(message);
}
