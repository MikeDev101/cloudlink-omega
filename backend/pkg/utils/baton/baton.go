package main


import (
	"fmt"
	"log"
	"strings"
)

// Client represents a node in the BATON overlay network.
type Client struct {
	ID   int64
	Name string
}

// Node is a n-ary tree node.
type Node[T any] struct {
	Parent   *Node[T]
	Children []*Node[T]
	Count    int
	Value    T
}

// NewTree creates a new n-ary tree with the given client as the root.
func NewTree(c *Client, size int) *Node[*Client] {
	return &Node[*Client]{
		Value:    c,
		Children: make([]*Node[*Client], size),
	}
}

// New creates a node given a client.
func New(c *Client) *Node[*Client] {
	return &Node[*Client]{
		Value: c,
	}
}

func Insert(n *Node[*Client], c *Node[*Client]) {
	// If the current node has fewer children than the maximum allowed
	if n.Count < len(n.Children) {

		log.Printf("Node %s has %d children, inserting %s\n", n.Value.Name, n.Count, c.Value.Name)

		// Insert the new node directly.
		n.Children[n.Count] = c
		c.Parent = n
		n.Count++
		return
	}

	log.Printf("Node %s is full, finding suitable sibling", n.Value.Name)

	// Find the next node at the same level
	var nextNode *Node[*Client]
	for _, sibling := range n.Children {
		if sibling.Count < len(sibling.Children) {
			nextNode = sibling
			break
		}
	}
	if nextNode == nil {
		// If all siblings are full, create a new node
		nextNode = New(nil)
		n.Children = append(n.Children, nextNode)
		nextNode.Parent = n
	}

	// Insert the new node into the next node at the same level
	nextNode.Children = append(nextNode.Children, c)
	c.Parent = nextNode
	nextNode.Count++
}

// BFSRoute finds the closest path between two nodes using BFS.
func BFSRoute(root *Node[*Client], target *Node[*Client]) []*Node[*Client] {
	if root == nil || target == nil {
		return nil
	}

	queue := []*Node[*Client]{root}
	parents := make(map[*Node[*Client]]*Node[*Client])
	visited := make(map[*Node[*Client]]bool)

	// Perform BFS
	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]

		visited[node] = true

		// Check if the node is valid. If not, skip it
		if node == nil {
			continue
		}

		// If the node has no value, skip it
		if node.Value == nil {
			continue
		}

		log.Println("Visiting node:", node.Value.Name)

		if node.Value.ID == target.Value.ID {
			log.Println("Found the target node!")
			// Found the target node, reconstruct the path
			path := []*Node[*Client]{node}
			for {
				parent, ok := parents[node]
				if !ok {
					break
				}
				path = append([]*Node[*Client]{parent}, path...)
				node = parent
			}
			return path
		}

		for _, child := range node.Children {
			if !visited[child] {
				queue = append(queue, child)
				parents[child] = node
			}
		}
	}

	return nil // Target node not found
}

func Print(node *Node[*Client]) {
	printTree(node, 0)
}

// Function to print the tree structure for debugging
func printTree(node *Node[*Client], level int) {
	if node == nil {
		return
	}
	if node.Value == nil {
		return
	}
	fmt.Printf("%s * %s\n", strings.Repeat(" ", level*4), node.Value.Name)
	for _, child := range node.Children {
		printTree(child, level+1)
	}
}

func main() {
	root := NewTree(&Client{ID: 0, Name: "root"}, 3)

	nodeA := New(&Client{ID: 1, Name: "A"})
	nodeB := New(&Client{ID: 2, Name: "B"})
	nodeC := New(&Client{ID: 3, Name: "C"})

	Insert(root, nodeA)
	Insert(root, nodeB)
	Insert(root, nodeC)

	// Create new level. Should be added to the tree with auto-balancing
	nodeD := New(&Client{ID: 4, Name: "D"})
	Insert(root, nodeD)

	// Print the tree structure for debugging
	Print(root)

	// Find the closest path between two nodes
	path := BFSRoute(root, nodeD)

	if path != nil {
		fmt.Println("Closest path from", root.Value.Name, "to", nodeD.Value.Name, ":")
		for _, node := range path {
			client := node.Value
			fmt.Println(client.Name)
		}
	} else {
		fmt.Println("No path found between", root.Value.Name, "and", nodeD.Value.Name)
	}
}
