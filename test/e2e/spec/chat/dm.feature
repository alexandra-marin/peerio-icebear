Feature: Direct Messages

    DM-specific cases go here.
    Most of the chat-related scenarios are in the room features.

    @BOT_create_and_use_a_dm_chat
    Scenario: Create and use a DM chat
        Given I create my account
        When  I start a DM with Cucumbot
        And   I send a message "Hi, Cucumbot!"
        Then  Cucumbot receives a message "Hi, Cucumbot!"
        When  Cucumbot sends a message "Hello, stranger."
        Then  I receive a message "Hello, stranger."
        When  I restart without login
        And   Cucumbot sends a message "I see you are offline."
        And   Cucumbot restarts
        And   I login
        And   Cucumbot starts a DM with me
        Then  Cucumbot receives a message "Hi, Cucumbot!"
        And   I receive a message "Hello, stranger."
        And   I receive a message "I see you are offline."
