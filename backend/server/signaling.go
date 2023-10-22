package cloudlink

func SignalingOpcode(message []byte, manager *Manager, client *Client) {
	// Something - Handle messages here
	// UnicastMessage(client, message, client)
	MulticastMessage(manager.clients, JSONDump(message), client)
}
