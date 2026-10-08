package models

import "time"

type User struct {
	ID		string		`json:"id"`
	Email		string		`json:"email"`
	Password	string		`json:"-"`
	FirstName	string		`json:"first_name"`
	LastName	string		`json:"last_name"`
	DateOfBirth	string		`json:"date_of_birth"`
	Avatar		string		`json:"avatar,omitempty"`
	Nickname	string		`json:"nickname,omitempty"`
	AboutMe		string		`json:"about_me,omitempty"`
	IsPublic	bool		`json:"is_public"`
	CreatedAt	time.Time	`json:"created_at"`
}

type Session struct {
	ID		string		`json:"id"`
	UserID		string		`json:"user_id"`
	CreatedAt	time.Time	`json:"created_at"`
	ExpiresAt	time.Time	`json:"expires_at"`
}

type Post struct {
	ID		string		`json:"id"`
	UserID		string		`json:"user_id"`
	Content		string		`json:"content"`
	Image		string		`json:"image,omitempty"`
	Privacy		string		`json:"privacy"`
	CreatedAt	time.Time	`json:"created_at"`
	Author		*User		`json:"author,omitempty"`
	Comments	[]Comment	`json:"comments,omitempty"`
	Viewers		[]string	`json:"viewers,omitempty"`
}

type Comment struct {
	ID		string		`json:"id"`
	PostID		string		`json:"post_id"`
	UserID		string		`json:"user_id"`
	Content		string		`json:"content"`
	Image		string		`json:"image,omitempty"`
	CreatedAt	time.Time	`json:"created_at"`
	Author		*User		`json:"author,omitempty"`
}

type Follower struct {
	FollowerID	string		`json:"follower_id"`
	FollowingID	string		`json:"following_id"`
	Status		string		`json:"status"`
	CreatedAt	time.Time	`json:"created_at"`
	User		*User		`json:"user,omitempty"`
}

type Group struct {
	ID		string		`json:"id"`
	CreatorID	string		`json:"creator_id"`
	Title		string		`json:"title"`
	Description	string		`json:"description"`
	CreatedAt	time.Time	`json:"created_at"`
	Creator		*User		`json:"creator,omitempty"`
	Members		[]GroupMember	`json:"members,omitempty"`
	IsMember	bool		`json:"is_member"`
}

type GroupMember struct {
	GroupID		string		`json:"group_id"`
	UserID		string		`json:"user_id"`
	Status		string		`json:"status"`
	InvitedBy	string		`json:"invited_by,omitempty"`
	CreatedAt	time.Time	`json:"created_at"`
	User		*User		`json:"user,omitempty"`
}

type GroupPost struct {
	ID		string		`json:"id"`
	GroupID		string		`json:"group_id"`
	UserID		string		`json:"user_id"`
	Content		string		`json:"content"`
	Image		string		`json:"image,omitempty"`
	CreatedAt	time.Time	`json:"created_at"`
	Author		*User		`json:"author,omitempty"`
	Comments	[]GroupComment	`json:"comments,omitempty"`
}

type GroupComment struct {
	ID		string		`json:"id"`
	PostID		string		`json:"post_id"`
	UserID		string		`json:"user_id"`
	Content		string		`json:"content"`
	Image		string		`json:"image,omitempty"`
	CreatedAt	time.Time	`json:"created_at"`
	Author		*User		`json:"author,omitempty"`
}

type GroupEvent struct {
	ID		string		`json:"id"`
	GroupID		string		`json:"group_id"`
	CreatorID	string		`json:"creator_id"`
	Title		string		`json:"title"`
	Description	string		`json:"description"`
	EventTime	time.Time	`json:"event_time"`
	CreatedAt	time.Time	`json:"created_at"`
	Creator		*User		`json:"creator,omitempty"`
	Responses	[]EventResponse	`json:"responses,omitempty"`
	UserResponse	string		`json:"user_response,omitempty"`
}

type EventResponse struct {
	EventID		string	`json:"event_id"`
	UserID		string	`json:"user_id"`
	Response	string	`json:"response"`
	User		*User	`json:"user,omitempty"`
}

type Message struct {
	ID		string		`json:"id"`
	SenderID	string		`json:"sender_id"`
	RecipientID	string		`json:"recipient_id"`
	Content		string		`json:"content"`
	CreatedAt	time.Time	`json:"created_at"`
	Sender		*User		`json:"sender,omitempty"`
}

type GroupMessage struct {
	ID		string		`json:"id"`
	GroupID		string		`json:"group_id"`
	SenderID	string		`json:"sender_id"`
	Content		string		`json:"content"`
	CreatedAt	time.Time	`json:"created_at"`
	Sender		*User		`json:"sender,omitempty"`
}

type Notification struct {
	ID		string		`json:"id"`
	UserID		string		`json:"user_id"`
	Type		string		`json:"type"`
	Content		string		`json:"content"`
	ReferenceID	string		`json:"reference_id,omitempty"`
	FromUserID	string		`json:"from_user_id,omitempty"`
	IsRead		bool		`json:"is_read"`
	CreatedAt	time.Time	`json:"created_at"`
	FromUser	*User		`json:"from_user,omitempty"`
}

type Conversation struct {
	User		User	`json:"user"`
	LastMessage	Message	`json:"last_message"`
	Unread		int	`json:"unread"`
}
