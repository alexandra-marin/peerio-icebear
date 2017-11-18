# Feature: Favorite contacts
#     @unregisteredUser
#     Scenario: Remove favorite contact before email confirmation
#         Given I invite an unregistered user
#         But   I remove the invitation
#         When  they sign up
#         And   they confirm their email
#         Then  they will not be in my favorites
