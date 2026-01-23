from rest_framework import serializers


class ChatMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["system", "user", "assistant"])
    content = serializers.CharField()


class ChatRequestSerializer(serializers.Serializer):
    model = serializers.CharField()
    messages = ChatMessageSerializer(many=True)


class ChatResponseSerializer(serializers.Serializer):
    content = serializers.CharField()
    duration_ms = serializers.IntegerField()
    thinking = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    error = serializers.CharField(required=False, allow_blank=True)


class ModelsResponseSerializer(serializers.Serializer):
    models = serializers.ListField(child=serializers.CharField())
    error = serializers.CharField(required=False, allow_blank=True)
