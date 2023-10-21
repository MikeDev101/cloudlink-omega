package cloudlink

type Packet struct {
	Opcode   string `json:"opcode"`
	Payload  interface{} `json:"payload"`
	Callback interface{} `json:"callback"`
}
