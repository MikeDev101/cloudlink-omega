package cloudlink

type Packet struct {
	Opcode  int         `json:"opcode"`
	Payload interface{} `json:"payload"`
	Tx      interface{} `json:"tx"`
	Rx      interface{} `json:"rx"`
}
