from rest_framework import serializers
from apps.chat.models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.display_name", read_only=True)
    sender_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "sender", "sender_name", "sender_avatar", "content", "created_at"]
        read_only_fields = ["id", "sender", "created_at"]

    def get_sender_avatar(self, obj):
        request = self.context.get("request")
        if obj.sender.avatar and request:
            return request.build_absolute_uri(obj.sender.avatar.url)
        return None
