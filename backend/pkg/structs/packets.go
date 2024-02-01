package structs

// Declare the packet format for signaling.
type SignalPacket struct {
	Opcode    string `json:"opcode"`
	Payload   any    `json:"payload"`
	Origin    string `json:"origin,omitempty"`
	Recipient string `json:"recipient,omitempty"`
}
