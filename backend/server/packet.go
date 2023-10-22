package cloudlinkOmega

type Packet struct {
	Opcode  int         `json:"opcode"`
	Payload interface{} `json:"payload,omitempty"`
	Tx      interface{} `json:"tx,omitempty"`
	Rx      interface{} `json:"rx,omitempty"`
}
